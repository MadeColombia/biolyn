"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import {
  deleteLink,
  reorderLinks,
  toggleEmbed,
  toggleLink,
  updateLink,
} from "./actions";
import { LinkForm, type EditableLink } from "./link-form";
import { PhotoManager } from "./photos";

export type LinkItem = EditableLink & { kind: "link"; is_visible: boolean };
export type GalleryItem = {
  kind: "gallery";
  id: string;
  title: string;
  is_visible: boolean;
  layout: GalleryLayout;
  photos: { id: string; url: string; alt: string }[];
};
/** One row of the list: a link or a photo carousel. */
export type ListItem = LinkItem | GalleryItem;

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
// starts fresh whenever the saved links change.
export function LinkList({
  items: initial,
  userId,
}: {
  items: ListItem[];
  userId: string;
}) {
  const t = useTranslations("linkList");
  const [links, setLinks] = useState(initial);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    // A small move threshold keeps taps on the buttons working.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = links.findIndex((l) => l.id === active.id);
    const to = links.findIndex((l) => l.id === over.id);
    const next = arrayMove(links, from, to);
    setLinks(next); // show the new order right away
    startTransition(() => reorderLinks(next.map((l) => l.id)));
  }

  if (links.length === 0) {
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
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={links} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-3">
          {links.map((item) =>
            item.kind === "gallery" ? (
              <SortableGallery key={item.id} gallery={item} userId={userId} />
            ) : (
              <SortableLink key={item.id} link={item} userId={userId} />
            ),
          )}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableLink({ link, userId }: { link: LinkItem; userId: string }) {
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
  const label =
    gallery.layout === "grid" ? t("photoGrid") : t("photoCarousel");

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
