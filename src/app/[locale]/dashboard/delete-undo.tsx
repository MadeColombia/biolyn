"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";

// How long Undo stays on screen before the delete really happens.
const UNDO_MS = 6000;

type Delete = {
  id: string;
  /** A section deleted with "keep its links". */
  keepLinks?: boolean;
  /** What the message calls it. */
  name: string;
  /** Deletes it for real. */
  run: () => Promise<unknown>;
};

type Undo = {
  /** Items that look deleted: waiting for Undo, or being deleted now. */
  hidden: { id: string; keepLinks?: boolean }[];
  /** Hides the item and offers Undo for a few seconds, then deletes it. */
  remove: (item: Delete) => void;
  /** Deletes anything waiting right away. Moves call this before saving
   * the new order, so the order never names a row that's about to go. */
  flush: () => Promise<void>;
};

const UndoContext = createContext<Undo>({
  hidden: [],
  remove: (item) => void item.run(),
  flush: async () => {},
});

export const useUndo = () => useContext(UndoContext);

/**
 * Wraps the Content tab so a delete can be taken back. Nothing is deleted
 * until Undo has gone, so a mistaken tap costs nothing. Leaving the tab or
 * the page deletes whatever is still waiting.
 */
export function DeleteUndo({ children }: { children: React.ReactNode }) {
  const t = useTranslations("undo");
  const [waiting, setWaiting] = useState<Delete | null>(null);
  const [sending, setSending] = useState<Delete[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The one waiting now, for the timer and for leaving the page.
  const current = useRef<Delete | null>(null);

  const send = useCallback(async (item: Delete) => {
    setSending((list) => [...list, item]);
    try {
      await item.run();
    } finally {
      setSending((list) => list.filter((i) => i !== item));
    }
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const item = current.current;
    current.current = null;
    setWaiting(null);
    if (item) await send(item);
  }, [send]);

  const remove = useCallback(
    (item: Delete) => {
      void flush();
      current.current = item;
      setWaiting(item);
      timer.current = setTimeout(() => void flush(), UNDO_MS);
    },
    [flush],
  );

  function undo() {
    clearTimeout(timer.current);
    current.current = null;
    setWaiting(null);
  }

  // Leaving the tab or closing the page finishes the waiting delete.
  useEffect(() => {
    const leave = () => void flush();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [flush]);

  const value = useMemo<Undo>(
    () => ({
      hidden: [...(waiting ? [waiting] : []), ...sending].map(
        ({ id, keepLinks }) => ({ id, keepLinks }),
      ),
      remove,
      flush,
    }),
    [waiting, sending, remove, flush],
  );

  return (
    <UndoContext.Provider value={value}>
      {children}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6"
      >
        {waiting && (
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink py-2 pr-2 pl-4 text-canvas shadow-lg">
            <p className="min-w-0 flex-1 truncate text-sm">
              {t("deleted", { name: waiting.name })}
            </p>
            <button
              type="button"
              onClick={undo}
              className="min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold text-canvas underline-offset-4 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas"
            >
              {t("undo")}
            </button>
          </div>
        )}
      </div>
    </UndoContext.Provider>
  );
}
