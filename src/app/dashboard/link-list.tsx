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
import { embedFor } from "@/lib/embeds";
import { deleteLink, reorderLinks, toggleEmbed, toggleLink } from "./actions";

type Link = {
  id: string;
  title: string;
  url: string;
  is_visible: boolean;
  embed: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

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
export function LinkList({ links: initial }: { links: Link[] }) {
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
      <p className="text-sm text-neutral-500">
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
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <SortableLink key={link.id} link={link} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableLink({ link }: { link: Link }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border bg-background p-3 ${link.is_visible ? "" : "opacity-50"} ${isDragging ? "relative z-10 shadow-lg" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${link.title}`}
        className="cursor-grab touch-none px-1 text-neutral-400 active:cursor-grabbing"
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{link.title}</p>
        <p className="truncate text-sm text-neutral-500">{link.url}</p>
        {scheduleText(link) && (
          <p className="text-xs text-blue-600" suppressHydrationWarning>
            {scheduleText(link)}
          </p>
        )}
      </div>
      {embedFor(link.url) && (
        <form action={toggleEmbed.bind(null, link.id, link.embed)}>
          <button className="text-sm underline">
            {link.embed ? "Show as button" : "Show as player"}
          </button>
        </form>
      )}
      <form action={toggleLink.bind(null, link.id, link.is_visible)}>
        <button className="text-sm underline">
          {link.is_visible ? "Hide" : "Show"}
        </button>
      </form>
      <form action={deleteLink.bind(null, link.id)}>
        <button className="text-sm text-red-600 underline">Delete</button>
      </form>
    </li>
  );
}
