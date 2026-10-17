"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
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
import {
  containerOf,
  moveBy,
  moveInto,
  withoutPending,
  type Tree,
} from "@/lib/item-tree";
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
import { useUndo } from "./delete-undo";
import { LinkForm, type EditableLink, type SectionOption } from "./link-form";
import { PhotoManager } from "./photos";
import { RowMenu, type MenuEntry } from "./row-menu";
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

const treeOf = (items: ListItem[]): Tree =>
  items.map((i) => ({
    id: i.id,
    children: i.kind === "section" ? i.links.map((l) => l.id) : [],
  }));

// The empty space inside a section that takes dropped links.
const DROP = "drop:";

/** Where a row's ⋯ menu can move it: the order after each move. */
type Moves = {
  up: Tree | null;
  down: Tree | null;
  /** "Move to": the main list and the sections with room. */
  to: { label: string; tree: Tree }[];
};

/** Shows a new order and saves it. */
type OnMove = (tree: Tree) => void;

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

export function LinkList({
  items,
  userId,
}: {
  items: ListItem[];
  userId: string;
}) {
  const t = useTranslations("linkList");
  const { hidden, remove, flush } = useUndo();
  const [tree, setTree] = useState(() => treeOf(items));
  const [dragging, setDragging] = useState(false);
  const [saving, startSaving] = useTransition();
  // The saved order changes after every save. Take it in, unless a drag
  // or a save is under way: then the order on screen is the newer one.
  const savedKey = JSON.stringify(treeOf(items));
  const [seen, setSeen] = useState(savedKey);
  if (savedKey !== seen && !dragging && !saving) {
    setSeen(savedKey);
    setTree(treeOf(items));
  }

  // What's on screen: the order, minus deletes waiting for Undo.
  const shown = withoutPending(tree, hidden);
  // The latest order, read by the drag handlers between renders.
  const current = useRef(shown);
  const before = useRef(tree);
  useLayoutEffect(() => {
    current.current = shown;
  });

  const sensors = useSensors(
    // A small move threshold keeps clicks on the buttons working.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // On phones, press and hold the handle for a moment first, so a
    // swipe that starts on it still scrolls the page.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
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

  // Shows the new order now and saves it. A delete still waiting for
  // Undo goes first, so the saved order matches the rows that are left.
  function save(next: Tree) {
    show(next);
    startSaving(async () => {
      await flush();
      await reorderItems(next);
    });
  }

  function movesFor(id: string): Moves {
    const moves: Moves = {
      up: moveBy(shown, id, -1),
      down: moveBy(shown, id, 1),
      to: [],
    };
    if (byId.get(id)?.kind !== "link") return moves;
    const into = (sectionId: string | null, label: string) => {
      const tree = moveInto(shown, id, sectionId);
      if (tree) moves.to.push({ label, tree });
    };
    into(null, t("mainList"));
    for (const s of sections) into(s.id, s.title ?? t("untitled"));
    return moves;
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
    setDragging(false);
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
    if (
      JSON.stringify(next) ===
      JSON.stringify(withoutPending(before.current, hidden))
    ) {
      // Nothing moved: keep the full order, so Undo can still bring back
      // a row that's waiting to be deleted.
      show(before.current);
    } else {
      save(next);
    }
  }

  if (shown.length === 0) {
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
        before.current = tree;
        setDragging(true);
        // A short buzz on Android phones says the row is picked up.
        navigator.vibrate?.(10);
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(false);
        show(before.current);
      }}
    >
      <SortableContext
        items={shown.map((e) => e.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-3">
          {shown.map(({ id, children }) => {
            const item = byId.get(id);
            if (!item) return null;
            if (item.kind === "gallery") {
              return (
                <SortableGallery
                  key={id}
                  gallery={item}
                  userId={userId}
                  moves={movesFor(id)}
                  onMove={save}
                  onDelete={() =>
                    remove({
                      id,
                      name: t("photoCarousel"),
                      run: () => deleteLink(id),
                    })
                  }
                />
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
                  moves={movesFor(id)}
                  onMove={save}
                  movesFor={movesFor}
                  onDelete={(keepLinks) =>
                    remove({
                      id,
                      keepLinks,
                      name: item.title ?? t("untitled"),
                      run: () => deleteSection(id, keepLinks),
                    })
                  }
                  onDeleteLink={(link) =>
                    remove({
                      id: link.id,
                      name: link.title,
                      run: () => deleteLink(link.id),
                    })
                  }
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
                moves={movesFor(id)}
                onMove={save}
                onDelete={() =>
                  remove({
                    id,
                    name: item.title,
                    run: () => deleteLink(id),
                  })
                }
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/** The menu lines every row shares: moving it, then deleting it. */
function useMoveEntries(
  moves: Moves,
  apply: OnMove,
  onDelete: () => void,
): MenuEntry[] {
  const t = useTranslations("linkList");
  const common = useTranslations("common");
  const { up, down, to } = moves;
  return [
    ...(up ? [{ label: t("moveUp"), onSelect: () => apply(up) }] : []),
    ...(down ? [{ label: t("moveDown"), onSelect: () => apply(down) }] : []),
    ...(to.length > 0
      ? [
          { group: t("moveTo") },
          ...to.map((m) => ({ label: m.label, onSelect: () => apply(m.tree) })),
        ]
      : []),
    { label: common("delete"), onSelect: onDelete, danger: true },
  ];
}

function SortableLink({
  link,
  sectionId,
  sections,
  userId,
  moves,
  onMove,
  onDelete,
}: {
  link: LinkItem;
  /** The section it's in now, or null on the main list. */
  sectionId: string | null;
  sections: SectionOption[];
  userId: string;
  moves: Moves;
  onMove: OnMove;
  onDelete: () => void;
}) {
  const t = useTranslations("linkList");
  const common = useTranslations("common");
  const form = useTranslations("linkForm");
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
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
  const picture =
    link.size === "big" ? (link.image_url ?? link.preview_url) : null;
  const moveEntries = useMoveEntries(moves, onMove, onDelete);
  const entries: MenuEntry[] = [
    {
      label: editing ? common("close") : common("edit"),
      onSelect: () => setEditing((on) => !on),
    },
    ...(embedFor(link.url)
      ? [
          {
            label: link.embed ? t("asButton") : t("asPlayer"),
            onSelect: () =>
              startTransition(() => toggleEmbed(link.id, link.embed)),
          },
        ]
      : []),
    {
      label: link.is_visible ? common("hide") : common("show"),
      onSelect: () =>
        startTransition(() => toggleLink(link.id, link.is_visible)),
    },
    ...moveEntries,
  ];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={row(isDragging, editing)}
    >
      <DragHandle
        label={link.title}
        handleRef={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      />
      <div className={cx(rowBody, !link.is_visible && "[&>*]:opacity-50")}>
        {picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture}
            referrerPolicy="no-referrer"
            alt=""
            className={cx(
              "aspect-video w-14 shrink-0 rounded-lg border border-edge sm:w-16",
              isIconPreview(picture)
                ? "bg-raised object-contain p-1"
                : "object-cover",
            )}
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate font-bold">{link.title}</span>
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
          </span>
          <span className="truncate text-sm text-ink-muted">{link.url}</span>
          {schedule && (
            <span className="text-xs text-ink-muted" suppressHydrationWarning>
              {schedule}
            </span>
          )}
        </span>
      </div>
      <EditButton
        label={t("edit", { name: link.title })}
        open={editing}
        controls={`edit-${link.id}`}
        onClick={() => setEditing((on) => !on)}
      />
      <RowMenu label={t("more", { name: link.title })} entries={entries} />
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

// A row turns grey as a whole under the pointer, except while its editor
// is open below it.
const row = (dragging: boolean, open: boolean) =>
  cx(
    "flex flex-wrap items-center gap-1 rounded-2xl border bg-surface p-1 transition-colors sm:gap-2 sm:p-2",
    !open && "hover:bg-raised",
    dragging
      ? "relative z-10 border-brand shadow-lg ring-2 ring-brand/30"
      : "border-edge",
  );

// The middle of a row: its picture, name and details.
const rowBody = "flex min-h-11 min-w-0 flex-1 items-center gap-3 px-1 py-1";

/** The pencil that opens a row's editor, where a section shows its arrow. */
function EditButton({
  label,
  open,
  controls,
  onClick,
}: {
  label: string;
  open: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
      className={cx(
        "flex size-11 shrink-0 items-center justify-center rounded-xl transition hover:bg-edge hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        open ? "bg-edge text-ink" : "text-ink-muted",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
        <path d="M13.5 6.5l4 4" />
      </svg>
    </button>
  );
}

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
      className="flex min-h-11 min-w-9 cursor-grab touch-none items-center justify-center rounded-xl text-ink-muted transition select-none hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:cursor-grabbing sm:min-w-11"
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
// link form its row opens the photo manager. A new, empty one starts open.
function SortableGallery({
  gallery,
  userId,
  moves,
  onMove,
  onDelete,
}: {
  gallery: GalleryItem;
  userId: string;
  moves: Moves;
  onMove: OnMove;
  onDelete: () => void;
}) {
  const t = useTranslations("linkList");
  const common = useTranslations("common");
  const [editing, setEditing] = useState(gallery.photos.length === 0);
  const [, startTransition] = useTransition();
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
  const moveEntries = useMoveEntries(moves, onMove, onDelete);
  const entries: MenuEntry[] = [
    {
      label: editing ? common("close") : t("editPhotos"),
      onSelect: () => setEditing((on) => !on),
    },
    {
      label: gallery.is_visible ? common("hide") : common("show"),
      onSelect: () =>
        startTransition(() => toggleLink(gallery.id, gallery.is_visible)),
    },
    ...moveEntries,
  ];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={row(isDragging, editing)}
    >
      <DragHandle
        label={label}
        handleRef={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      />
      <div className={cx(rowBody, !gallery.is_visible && "[&>*]:opacity-50")}>
        <span className="flex shrink-0 -space-x-6" aria-hidden>
          {count === 0 ? (
            <span className="flex aspect-video w-14 items-center justify-center rounded-lg border border-dashed border-edge bg-raised text-ink-muted sm:w-16">
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
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate font-bold">{label}</span>
            {!gallery.is_visible && (
              <Badge tone="neutral" className="shrink-0">
                {t("hidden")}
              </Badge>
            )}
          </span>
          <span className="truncate text-sm text-ink-muted">
            {count === 0 ? t("noPhotos") : t("photoCount", { count })}
          </span>
        </span>
      </div>
      <EditButton
        label={t("edit", { name: label })}
        open={editing}
        controls={`edit-${gallery.id}`}
        onClick={() => setEditing((on) => !on)}
      />
      <RowMenu label={t("more", { name: label })} entries={entries} />
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
// dragged within it, out of it, or into it from the main list. Tapping
// the title row folds the links away.
function SortableSection({
  section,
  links,
  sections,
  userId,
  moves,
  movesFor,
  onMove,
  onDelete,
  onDeleteLink,
}: {
  section: SectionItem;
  links: LinkItem[];
  sections: SectionOption[];
  userId: string;
  moves: Moves;
  movesFor: (id: string) => Moves;
  onMove: OnMove;
  onDelete: (keepLinks: boolean) => void;
  onDeleteLink: (link: LinkItem) => void;
}) {
  const t = useTranslations("linkList");
  const common = useTranslations("common");
  const addT = useTranslations("addItem");
  const linkForm = useTranslations("linkForm");
  const [open, setOpen] = useState<"edit" | "add" | "delete" | null>(null);
  const [folded, setFolded] = useState(false);
  const [, startTransition] = useTransition();
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
  const full = links.length >= MAX_SECTION_LINKS;
  const openPanel = (panel: "edit" | "add" | "delete") => {
    setFolded(false);
    setOpen((now) => (now === panel ? null : panel));
  };
  const moveEntries = useMoveEntries(moves, onMove, () =>
    links.length > 0 ? openPanel("delete") : onDelete(false),
  );
  const entries: MenuEntry[] = [
    {
      label: open === "edit" ? common("close") : common("edit"),
      onSelect: () => openPanel("edit"),
    },
    ...(full
      ? []
      : [{ label: t("addHere"), onSelect: () => openPanel("add") }]),
    {
      label: section.is_visible ? common("hide") : common("show"),
      onSelect: () =>
        startTransition(() => toggleLink(section.id, section.is_visible)),
    },
    ...moveEntries,
  ];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        "flex flex-col gap-2 rounded-3xl border bg-raised/50 p-1 sm:p-2",
        isDragging
          ? "relative z-10 border-brand shadow-lg ring-2 ring-brand/30"
          : "border-edge",
      )}
    >
      <div className="flex items-center gap-1 rounded-2xl transition-colors hover:bg-edge/60 sm:gap-2">
        <DragHandle
          label={name}
          handleRef={setActivatorNodeRef}
          {...attributes}
          {...listeners}
        />
        <button
          type="button"
          aria-expanded={!folded}
          aria-controls={`links-${section.id}`}
          onClick={() => setFolded((on) => !on)}
          className={cx(
            rowBody,
            "rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            !section.is_visible && "[&>*]:opacity-50",
          )}
        >
          <span className="hidden w-16 shrink-0 rounded-lg border border-edge bg-surface px-1.5 sm:block">
            <LayoutPicture layout={section.layout} small />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <span
                className={cx(
                  "truncate font-bold",
                  !section.title && "text-ink-muted italic",
                )}
              >
                {name}
              </span>
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
            </span>
            <span className="truncate text-sm text-ink-muted">
              {links.length === 0
                ? t("emptySection")
                : t("linkCount", { count: links.length })}
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={cx(
              "shrink-0 text-ink-muted transition",
              folded && "-rotate-90",
            )}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <RowMenu label={t("more", { name })} entries={entries} />
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
              onClick={() => onDelete(true)}
            >
              {t("keepLinks")}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => onDelete(false)}
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

      {!folded && (
        <div id={`links-${section.id}`} className="flex flex-col gap-2">
          <SortableContext
            items={links.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2 pl-2 sm:pl-6">
              {links.map((link) => (
                <SortableLink
                  key={link.id}
                  link={link}
                  sectionId={section.id}
                  sections={sections}
                  userId={userId}
                  moves={movesFor(link.id)}
                  onMove={onMove}
                  onDelete={() => onDeleteLink(link)}
                />
              ))}
              {links.length === 0 && <DropZone sectionId={section.id} />}
            </ul>
          </SortableContext>

          {!full &&
            (open === "add" ? (
              <div className="ml-2 rounded-2xl border border-edge bg-surface p-4 sm:ml-6">
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
                onClick={() => openPanel("add")}
                className="ml-2 flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-edge text-sm font-bold text-brand transition hover:border-brand hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:ml-6"
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
        </div>
      )}
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
