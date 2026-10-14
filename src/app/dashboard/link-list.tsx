"use client";

import { useState, useTransition } from "react";
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
import { isIconPreview } from "@/lib/link-form";
import {
  deleteLink,
  reorderLinks,
  toggleEmbed,
  toggleLink,
  updateLink,
} from "./actions";
import { LinkForm, type EditableLink } from "./link-form";

type Link = EditableLink & { is_visible: boolean };

// Shown in the creator's own time zone. The server renders UTC first,
// so the text is allowed to change once the browser takes over.
function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function scheduleText(link: Link) {
  if (link.starts_at && link.ends_at) {
    return `Shows ${when(link.starts_at)} to ${when(link.ends_at)}`;
  }
  if (link.starts_at) return `Shows from ${when(link.starts_at)}`;
  if (link.ends_at) return `Hides after ${when(link.ends_at)}`;
  return null;
}

// The parent gives this a `key` built from the server data, so the list
// starts fresh whenever the saved links change.
export function LinkList({
  links: initial,
  userId,
}: {
  links: Link[];
  userId: string;
}) {
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
        No links yet. Add your first one above.
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
          {links.map((link) => (
            <SortableLink key={link.id} link={link} userId={userId} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableLink({ link, userId }: { link: Link; userId: string }) {
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

  const schedule = scheduleText(link);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        "flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2",
        isDragging ? "relative z-10 border-brand" : "border-edge",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${link.title}`}
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
              Big
            </Badge>
          )}
          {!link.is_visible && (
            <Badge tone="neutral" className="shrink-0">
              Hidden
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
          {editing ? "Close" : "Edit"}
        </Button>
        {embedFor(link.url) && (
          <form action={toggleEmbed.bind(null, link.id, link.embed)}>
            <Button variant="ghost" size="sm">
              {link.embed ? "Show as button" : "Show as player"}
            </Button>
          </form>
        )}
        <form action={toggleLink.bind(null, link.id, link.is_visible)}>
          <Button variant="ghost" size="sm">
            {link.is_visible ? "Hide" : "Show"}
          </Button>
        </form>
        <form action={deleteLink.bind(null, link.id)}>
          <Button variant="danger" size="sm">
            Delete
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
            submitLabel="Save changes"
            pendingLabel="Saving..."
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </li>
  );
}
