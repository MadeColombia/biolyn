"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Heading, cx } from "@/components/ui";
import { addGallery, addLink } from "./actions";
import { LinkForm } from "./link-form";

type Step = "choose" | "link";

/**
 * The "+ Add" button. It opens a popup that asks what to add: a link
 * (the link form opens in the same popup) or a photo carousel (added
 * right away, then filled with photos from its row in the list).
 */
export function AddItemMenu({ userId }: { userId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("choose");
  // A new key each time the popup opens gives a fresh, empty link form.
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setStep("choose");
    setError(null);
    setRound((n) => n + 1);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
  }

  function addCarousel() {
    setError(null);
    startTransition(async () => {
      const result = await addGallery();
      if (result.error) setError(result.error);
      else close();
    });
  }

  return (
    <>
      <Button size="lg" fullWidth onClick={open}>
        <PlusIcon />
        Add
      </Button>

      {/* Native dialog: Esc closes it and focus goes back to "+ Add". */}
      <dialog
        ref={dialog}
        aria-labelledby="add-item-title"
        onClick={(e) => {
          // A click on the dark backdrop (the dialog itself) closes it.
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto max-h-[90dvh] w-[min(92vw,36rem)] overflow-y-auto rounded-3xl border border-edge bg-surface p-0 text-ink backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-between gap-3">
            <Heading as="h2" size="section" id="add-item-title">
              {step === "choose" ? "What do you want to add?" : "Add a link"}
            </Heading>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-muted transition hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {step === "choose" ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice
                  icon={<LinkIcon />}
                  title="Link"
                  hint="A button to any website, video or song"
                  onClick={() => setStep("link")}
                  disabled={pending}
                />
                <Choice
                  icon={<CarouselIcon />}
                  title="Photo carousel"
                  hint="Up to 12 photos, as a carousel or a grid"
                  onClick={addCarousel}
                  disabled={pending}
                  busy={pending}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <LinkForm
              key={round}
              userId={userId}
              action={addLink}
              submitLabel="Add link"
              pendingLabel="Adding..."
              onSaved={close}
              onCancel={() => setStep("choose")}
            />
          )}
        </div>
      </dialog>
    </>
  );
}

function Choice({
  icon,
  title,
  hint,
  onClick,
  disabled,
  busy = false,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex flex-col items-start gap-3 rounded-2xl border border-edge bg-surface p-4 text-left transition hover:border-brand hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50",
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-raised text-brand">
        {icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-bold text-ink">{busy ? "Adding..." : title}</span>
        <span className="text-sm text-ink-muted">{hint}</span>
      </span>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  );
}

function CarouselIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="6" y="4" width="12" height="13" rx="2.5" />
      <rect x="1" y="6" width="3.5" height="9" rx="1.2" opacity=".4" />
      <rect x="19.5" y="6" width="3.5" height="9" rx="1.2" opacity=".4" />
      <circle cx="9" cy="20.5" r="1.3" />
      <circle cx="12" cy="20.5" r="1.3" opacity=".4" />
      <circle cx="15" cy="20.5" r="1.3" opacity=".4" />
    </svg>
  );
}
