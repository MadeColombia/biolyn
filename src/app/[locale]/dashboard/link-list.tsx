"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge, Button, cx } from "@/components/ui";
import { embedFor } from "@/lib/embeds";
import type { GalleryLayout } from "@/lib/gallery";
import { isIconPreview } from "@/lib/link-form";
import { MAX_SECTION_LINKS, type SectionLayout } from "@/lib/sections";
import {
  addLink,
  deleteLink,
  deleteSection,
  reorderItems,
  toggleEmbed,
  toggleLink,
  updateLink,
  updateSection,
} from "./actions";
import { LinkForm, type EditableLink, type SectionOption } from "./link-form";
import { PhotoManager } from "./photos";
import { LayoutPicture, SectionForm } from "./section-form";

export type LinkItem = EditableLink & { kind: "link"; is_visible: boolean };
export type GalleryItem = {
  kind: "gallery";
  id: string;
  title: string;
  is_visible: boolean;
  layout: GalleryLayout;
  photos: { id: string; url: string; alt: string }[];
};
export type SectionItem = {
  kind: "section";
  id: string;
  title: string | null;
  is_visible: boolean;
  layout: SectionLayout;
  links: LinkItem[];
};
/** One top-level row of the list: a link, a photo carousel or a section. */
export type ListItem = LinkItem | GalleryItem | SectionItem;

// The order on screen: top-level ids, and the link ids in each section.
type Tree = { id: string; children: string[] }[];

const treeOf = (items: ListItem[]): Tree =>
  items.map((i) => ({
    id: i.id,
    children: i.kind === "section" ? i.links.map((l) => l.id) : [],
  }));

// Where an item sits: "top", or the id of its section.
function containerOf(tree: Tree, id: string): string | null {
  if (tree.some((e) => e.id === id)) return "top";
  return tree.find((e) => e.children.includes(id))?.id ?? null;
}

// The empty space inside a section that takes dropped links.
const DROP = "drop:";

// Shown in the creator's own time zone. The server renders UTC first,
// so the text is allowed to change once the browser takes over.
function when(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function useScheduleText(link: LinkItem) {
  const t = useTranslations("linkList");
  const locale = useLocale();
  const start = link.starts_at && when(link.starts_at, locale);
  const end = link.ends_at && when(link.ends_at, locale);
  if (start && end) return t("showsBetween", { start, end });
  if (start) return t("showsFrom", { start });
  if (end) return t("hidesAfter", { end });
  return null;
}

// The parent gives this a `key` built from the server data, so the list
// starts fresh whenever the saved items change.
export function LinkList({
  items,
  userId,
}: {
  items: ListItem[];
  userId: string;
}) {
  const t = useTranslations("linkList");
  const [tree, setTree] = useState(() => treeOf(items));
  // The latest order, read by the drag handlers between renders.
  const current = useRef(tree);
  const before = useRef(tree);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    // A small move threshold keeps taps on the buttons working.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const byId = new Map<string, ListItem>();
  for (const item of items) {
    byId.set(item.id, item);
    if (item.kind === "section") {
      for (const link of item.links) byId.set(link.id, link);
    }
  }
  const sections: SectionOption[] = items.flatMap((i) =>
    i.kind === "section"
      ? [{ id: i.id, title: i.title, layout: i.layout }]
      : [],
  );

  function show(next: Tree) {
    current.current = next;
    setTree(next);
  }

  // The section a link would land in when it's over `overId`: the section
  // itself (its title row or its empty space), or null when it's over
  // another row.
  function sectionUnder(overId: string): string | null {
    if (overId.startsWith(DROP)) return overId.slice(DROP.length);
    return byId.get(overId)?.kind === "section" ? overId : null;
  }

  // Sections, photo carousels and links at the top level only swap with
  // top-level rows. Links can also go into sections that have room.
  const collisions: CollisionDetection = (args) => {
    const activeId = String(args.active.id);
    const isLink = byId.get(activeId)?.kind === "link";
    const top = new Set(current.current.map((e) => e.id));
    const droppableContainers = args.droppableContainers.filter((c) => {
      const id = String(c.id);
      if (!isLink) return top.has(id);
      const section = sectionUnder(id);
      if (!section) return true;
      const inside =
        current.current.find((e) => e.id === section)?.children ?? [];
      return inside.includes(activeId) || inside.length < MAX_SECTION_LINKS;
    });
    const hits = pointerWithin({ ...args, droppableContainers });
    return hits.length > 0
      ? hits
      : closestCenter({ ...args, droppableContainers });
  };

  // Moves a link between the main list and a section while it's dragged,
  // so the rows open up where it will land.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    if (byId.get(id)?.kind !== "link") return;
    const tree = current.current;
    const from = containerOf(tree, id);
    const to = sectionUnder(overId) ?? containerOf(tree, overId);
    if (!from || !to || from === to) return;

    let next = tree
      .filter((e) => e.id !== id)
      .map((e) =>
        e.id === from
          ? { ...e, children: e.children.filter((c) => c !== id) }
          : e,
      );
    if (to === "top") {
      const at = next.findIndex((e) => e.id === overId);
      next.splice(at < 0 ? next.length : at, 0, { id, children: [] });
    } else {
      next = next.map((e) => {
        if (e.id !== to) return e;
        const children = [...e.children];
        const at = children.indexOf(overId);
        children.splice(at < 0 ? children.length : at, 0, id);
        return { ...e, children };
      });
    }
    show(next);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    let next = current.current;
    const id = String(active.id);
    const overId = over ? String(over.id) : null;
    if (overId && overId !== id) {
      const container = containerOf(next, id);
      if (container && container === containerOf(next, overId)) {
        next =
          container === "top"
            ? arrayMove(
                next,
                next.findIndex((e) => e.id === id),
                next.findIndex((e) => e.id === overId),
              )
            : next.map((e) =>
                e.id === container
                  ? {
                      ...e,
                      children: arrayMove(
                        e.children,
                        e.children.indexOf(id),
                        e.children.indexOf(overId),
                      ),
                    }
                  : e,
              );
      }
    }
    show(next); // show the new order right away
    if (JSON.stringify(next) !== JSON.stringify(before.current)) {
      before.current = next;
      startTransition(() => reorderItems(next));
    }
  }

  if (tree.length === 0) {
    return (
      <p className="rounded-2xl bg-raised p-6 text-center text-ink-soft">
        {t("empty")}
      </p>
    );
  }

  return (
    <DndContext
      id="links"
      sensors={sensors}
      collisionDetection={collisions}
      onDragStart={() => {
        before.current = current.current;
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => show(before.current)}
    >
      <SortableContext
        items={tree.map((e) => e.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-3">
          {tree.map(({ id, children }) => {
            const item = byId.get(id);
            if (!item) return null;
            if (item.kind === "gallery") {
              return (
                <SortableGallery key={id} gallery={item} userId={userId} />
              );
            }
            if (item.kind === "section") {
              return (
                <SortableSection
                  key={id}
                  section={item}
                  links={children.flatMap((c) => {
                    const link = byId.get(c);
                    return link?.kind === "link" ? [link] : [];
                  })}
                  sections={sections}
                  userId={userId}
                />
              );
            }
            return (
              <SortableLink
                key={id}
                link={item}
                sectionId={null}
                sections={sections}
                userId={userId}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableLink({
  link,
  sectionId,
  sections,
  userId,
}: {
  link: LinkItem;
  /** The section it's in now, or null on the main list. */
  sectionId: string | null;
  sections: SectionOption[];
  userId: string;
}) {
  const t = useTranslations("linkList");
  const common = useTranslations("common");
  const form = useTranslations("linkForm");
  const [editing, setEditing] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const schedule = useScheduleText(link);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={row(isDragging)}
    >
      <DragHandle
        label={link.title}
        handleRef={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      />
      {link.size === "big" && (link.image_url || link.preview_url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={(link.image_url ?? link.preview_url)!}
          referrerPolicy="no-referrer"
          alt=""
          className={cx(
            "aspect-video w-16 shrink-0 rounded-lg border border-edge",
            isIconPreview(link.image_url ?? link.preview_url)
              ? "bg-raised object-contain p-1"
              : "object-cover",
            !link.is_visible && "opacity-50",
          )}
        />
      )}
      <div
        className={cx(
          "min-w-0 flex-1 basis-40",
          !link.is_visible && "opacity-50",
        )}
      >
        <div className="flex items-center gap-2">
          <p className="truncate font-bold">{link.title}</p>
          {link.size === "big" && !(link.embed && embedFor(link.url)) && (
            <Badge tone="neutral" className="shrink-0">
              {t("big")}
            </Badge>
          )}
          {!link.is_visible && (
            <Badge tone="neutral" className="shrink-0">
              {t("hidden")}
            </Badge>
          )}
        </div>
        <p className="truncate text-sm text-ink-muted">{link.url}</p>
        {schedule && (
          <p className="text-xs text-ink-muted" suppressHydrationWarning>
            {schedule}
          </p>
        )}
      </div>
      <div className="flex w-full flex-wrap justify-end gap-1 sm:w-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={editing}
          aria-controls={`edit-${link.id}`}
          onClick={() => setEditing((on) => !on)}
        >
          {editing ? common("close") : common("edit")}
        </Button>
        {embedFor(link.url) && (
          <form action={toggleEmbed.bind(null, link.id, link.embed)}>
            <Button variant="ghost" size="sm">
              {link.embed ? t("asButton") : t("asPlayer")}
            </Button>
          </form>
        )}
        <form action={toggleLink.bind(null, link.id, link.is_visible)}>
          <Button variant="ghost" size="sm">
            {link.is_visible ? common("hide") : common("show")}
          </Button>
        </form>
        <form action={deleteLink.bind(null, link.id)}>
          <Button variant="danger" size="sm">
            {common("delete")}
          </Button>
        </form>
      </div>
      {editing && (
        <div
          id={`edit-${link.id}`}
          className="w-full border-t border-line px-2 pt-4 pb-2"
        >
          <LinkForm
            userId={userId}
            link={link}
            sections={sections}
            sectionId={sectionId}
            action={updateLink.bind(null, link.id)}
            submitLabel={form("saveChanges")}
            pendingLabel={common("saving")}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </li>
  );
}

const row = (dragging: boolean) =>
  cx(
    "flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2",
    dragging ? "relative z-10 border-brand" : "border-edge",
  );

function DragHandle({
  label,
  handleRef,
  ...props
}: {
  label: string;
  handleRef: (el: HTMLElement | null) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = useTranslations("linkList");
  return (
    <button
      ref={handleRef}
      type="button"
      {...props}
      aria-label={t("drag", { name: label })}
      className="flex min-h-11 min-w-11 cursor-grab touch-none items-center justify-center rounded-xl text-ink-muted transition hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:cursor-grabbing"
    >
      <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden>
        {[3, 9].map((x) =>
          [3, 9, 15].map((y) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="1.6"
              fill="currentColor"
            />
          )),
        )}
      </svg>
    </button>
  );
}

// A photo carousel in the list. It has no web address, so instead of the
// link form its Edit opens the photo manager. A new, empty one starts open.
function SortableGallery({
  gallery,
  userId,
}: {
  gallery: GalleryItem;
  userId: string;
}) {
  const t = useTranslations("linkList");
  const common = useTranslations("common");
  const [editing, setEditing] = useState(gallery.photos.length === 0);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: gallery.id });
  const count = gallery.photos.length;
  const label = gallery.layout === "grid" ? t("photoGrid") : t("photoCarousel");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={row(isDragging)}
    >
      <DragHandle
        label={label}
        handleRef={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      />
      <div
        className={cx(
          "flex shrink-0 -space-x-6",
          !gallery.is_visible && "opacity-50",
        )}
        aria-hidden
      >
        {count === 0 ? (
          <span className="flex aspect-video w-16 items-center justify-center rounded-lg border border-dashed border-edge bg-raised text-ink-muted">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 16l5-5 4 4 3-3 6 6" />
            </svg>
          </span>
        ) : (
          gallery.photos.slice(0, 3).map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt=""
              className="size-10 rounded-lg border-2 border-surface object-cover"
            />
          ))
        )}
      </div>
      <div
        className={cx(
          "min-w-0 flex-1 basis-40",
          !gallery.is_visible && "opacity-50",
        )}
      >
        <div className="flex items-center gap-2">
          <p className="truncate font-bold">{label}</p>
          {!gallery.is_visible && (
            <Badge tone="neutral" className="shrink-0">
              {t("hidden")}
            </Badge>
          )}
        </div>
        <p className="truncate text-sm text-ink-muted">
          {count === 0 ? t("noPhotos") : t("photoCount", { count })}
        </p>
      </div>
      <div className="flex w-full flex-wrap justify-end gap-1 sm:w-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={editing}
          aria-controls={`edit-${gallery.id}`}
          onClick={() => setEditing((on) => !on)}
        >
          {editing ? common("close") : common("edit")}
        </Button>
        <form action={toggleLink.bind(null, gallery.id, gallery.is_visible)}>
          <Button variant="ghost" size="sm">
            {gallery.is_visible ? common("hide") : common("show")}
          </Button>
        </form>
        <form action={deleteLink.bind(null, gallery.id)}>
          <Button variant="danger" size="sm">
            {common("delete")}
          </Button>
        </form>
      </div>
      {editing && (
        <div
          id={`edit-${gallery.id}`}
          className="w-full border-t border-line px-2 pt-4 pb-2"
        >
          <PhotoManager
            galleryId={gallery.id}
            userId={userId}
            layout={gallery.layout}
            photos={gallery.photos}
          />
        </div>
      )}
    </li>
  );
}

// A section: its title row, then the links inside it, which can be
// dragged within it, out of it, or into it from the main list.
function SortableSection({
  section,
  links,
  sections,
  userId,
}: {
  section: SectionItem;
  links: LinkItem[];
  sections: SectionOption[];
  userId: string;
}) {
  const t = useTranslations("linkList");
  const common = useTranslations("common");
  const addT = useTranslations("addItem");
  const linkForm = useTranslations("linkForm");
  const [open, setOpen] = useState<"edit" | "add" | "delete" | null>(null);
  const [deleting, startDelete] = useTransition();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });
  const name = section.title ?? t("untitled");
  const toggle = (panel: "edit" | "add" | "delete") =>
    setOpen((now) => (now === panel ? null : panel));

  function remove(keepLinks: boolean) {
    startDelete(() => deleteSection(section.id, keepLinks));
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        "flex flex-col gap-2 rounded-3xl border bg-raised/50 p-2",
        isDragging ? "relative z-10 border-brand" : "border-edge",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <DragHandle
          label={name}
          handleRef={setActivatorNodeRef}
          {...attributes}
          {...listeners}
        />
        <span
          className={cx(
            "hidden w-16 shrink-0 rounded-lg border border-edge bg-surface px-1.5 sm:block",
            !section.is_visible && "opacity-50",
          )}
        >
          <LayoutPicture layout={section.layout} small />
        </span>
        <div
          className={cx(
            "min-w-0 flex-1 basis-40",
            !section.is_visible && "opacity-50",
          )}
        >
          <div className="flex items-center gap-2">
            <p
              className={cx(
                "truncate font-bold",
                !section.title && "text-ink-muted italic",
              )}
            >
              {name}
            </p>
            <Badge tone="neutral" className="shrink-0">
              {section.layout === "carousel"
                ? t("styleCarousel")
                : t("styleList")}
            </Badge>
            {!section.is_visible && (
              <Badge tone="neutral" className="shrink-0">
                {t("hidden")}
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-ink-muted">
            {links.length === 0
              ? t("emptySection")
              : t("linkCount", { count: links.length })}
          </p>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-1 sm:w-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open === "edit"}
            aria-controls={`edit-${section.id}`}
            onClick={() => toggle("edit")}
          >
            {open === "edit" ? common("close") : common("edit")}
          </Button>
          <form action={toggleLink.bind(null, section.id, section.is_visible)}>
            <Button variant="ghost" size="sm">
              {section.is_visible ? common("hide") : common("show")}
            </Button>
          </form>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={deleting}
            aria-expanded={links.length > 0 ? open === "delete" : undefined}
            onClick={() =>
              links.length > 0 ? toggle("delete") : remove(false)
            }
          >
            {common("delete")}
          </Button>
        </div>
      </div>

      {open === "edit" && (
        <div
          id={`edit-${section.id}`}
          className="rounded-2xl border border-edge bg-surface p-4"
        >
          <SectionForm
            section={section}
            action={updateSection.bind(null, section.id)}
            submitLabel={linkForm("saveChanges")}
            pendingLabel={common("saving")}
            onSaved={() => setOpen(null)}
            onCancel={() => setOpen(null)}
          />
        </div>
      )}

      {open === "delete" && (
        <div
          role="group"
          aria-labelledby={`delete-${section.id}`}
          className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-surface p-4"
        >
          <p id={`delete-${section.id}`} className="font-bold">
            {t("deleteSectionTitle")}
          </p>
          <p className="text-sm text-ink-soft">
            {t("deleteSectionText", { count: links.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => remove(true)}
            >
              {t("keepLinks")}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={() => remove(false)}
            >
              {t("deleteAll")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(null)}
            >
              {common("cancel")}
            </Button>
          </div>
        </div>
      )}

      <SortableContext
        items={links.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2 pl-3 sm:pl-6">
          {links.map((link) => (
            <SortableLink
              key={link.id}
              link={link}
              sectionId={section.id}
              sections={sections}
              userId={userId}
            />
          ))}
          {links.length === 0 && <DropZone sectionId={section.id} />}
        </ul>
      </SortableContext>

      {links.length < MAX_SECTION_LINKS &&
        (open === "add" ? (
          <div className="ml-3 rounded-2xl border border-edge bg-surface p-4 sm:ml-6">
            <LinkForm
              userId={userId}
              sections={sections}
              sectionId={section.id}
              action={addLink}
              submitLabel={addT("addLink")}
              pendingLabel={common("adding")}
              onSaved={() => setOpen(null)}
              onCancel={() => setOpen(null)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggle("add")}
            className="ml-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-edge text-sm font-bold text-brand transition hover:border-brand hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:ml-6"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("addHere")}
          </button>
        ))}
    </li>
  );
}

// The space in an empty section where a dragged link can be dropped.
function DropZone({ sectionId }: { sectionId: string }) {
  const t = useTranslations("linkList");
  const { setNodeRef, isOver } = useDroppable({ id: `${DROP}${sectionId}` });
  return (
    <li
      ref={setNodeRef}
      className={cx(
        "flex min-h-14 items-center justify-center rounded-2xl border-2 border-dashed p-3 text-sm text-ink-muted",
        isOver ? "border-brand bg-surface" : "border-edge",
      )}
    >
      {t("dropHere")}
    </li>
  );
}
