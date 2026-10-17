"use client";

import { useId, useRef } from "react";
import { cx } from "@/components/ui";

export type MenuEntry =
  | { label: string; onSelect: () => void; danger?: boolean }
  | { group: string };

/**
 * The ⋯ button on a row and the list of actions it opens. On phones the
 * list slides up from the bottom of the screen, in thumb reach. On bigger
 * screens it opens under the button. Esc or a tap outside closes it.
 */
export function RowMenu({
  label,
  entries,
}: {
  /** Names the button for screen readers, like "More for Shop". */
  label: string;
  entries: MenuEntry[];
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Puts the list under the button (or above it when there's no room
  // below). Phones keep the bottom sheet from the classes.
  function place() {
    const el = list.current;
    const anchor = button.current?.getBoundingClientRect();
    if (!el || !anchor) return;
    if (!window.matchMedia("(min-width: 40rem)").matches) {
      el.style.top = el.style.left = "";
      return;
    }
    const height = el.offsetHeight;
    const below = anchor.bottom + 4 + height <= window.innerHeight - 8;
    el.style.top = `${below ? anchor.bottom + 4 : Math.max(8, anchor.top - 4 - height)}px`;
    el.style.left = `${Math.max(8, anchor.right - el.offsetWidth)}px`;
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        aria-label={label}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-muted transition hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          {[5, 12, 19].map((x) => (
            <circle key={x} cx={x} cy="12" r="2" fill="currentColor" />
          ))}
        </svg>
      </button>
      <div
        ref={list}
        id={id}
        popover="auto"
        onToggle={(e) => {
          if (e.newState !== "open") return;
          place();
          list.current?.querySelector("button")?.focus();
        }}
        className="m-0 max-h-[80dvh] overflow-y-auto border border-edge bg-surface p-2 text-ink shadow-xl max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:rounded-t-3xl max-sm:pb-[calc(0.5rem+env(safe-area-inset-bottom))] max-sm:backdrop:bg-black/40 sm:inset-auto sm:w-64 sm:rounded-2xl"
      >
        {/* A grab bar, so the sheet reads as one on phones. */}
        <span
          aria-hidden
          className="mx-auto mt-1 mb-2 block h-1 w-10 rounded-full bg-edge sm:hidden"
        />
        <ul className="flex flex-col">
          {entries.map((entry) =>
            "group" in entry ? (
              <li
                key={`group-${entry.group}`}
                className="px-3 pt-3 pb-1 text-xs font-bold text-ink-muted"
              >
                {entry.group}
              </li>
            ) : (
              <li key={entry.label}>
                <button
                  type="button"
                  onClick={() => {
                    list.current?.hidePopover();
                    entry.onSelect();
                  }}
                  className={cx(
                    "flex min-h-12 w-full items-center rounded-xl px-3 text-left font-semibold transition hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:min-h-11 sm:text-sm",
                    entry.danger ? "text-danger" : "text-ink",
                  )}
                >
                  {entry.label}
                </button>
              </li>
            ),
          )}
        </ul>
      </div>
    </>
  );
}
