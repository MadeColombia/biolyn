"use client";

import { useRef, useState } from "react";
import { Button, Heading, Skeleton, button, cx } from "@/components/ui";

export type CardChoice = {
  id: string;
  label: string;
  /** The card picture, shown as the preview. */
  src: string;
  /** Same picture, sent as a file to save. */
  download: string;
  /** Add to Apple Wallet / Google Wallet, when their keys are set up. */
  apple?: string;
  google?: string;
};

function WalletIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      // Hidden on phones, where two buttons share one row.
      className="hidden size-5 shrink-0 sm:block"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 9h16M15 14h2" />
    </svg>
  );
}

/**
 * Preview of the share card with a style picker and a Download button.
 * The pictures are drawn on the server (see /api/qr-card).
 */
export function ShareCardPicker({
  choices,
  fileName,
}: {
  choices: CardChoice[];
  fileName: string;
}) {
  const [id, setId] = useState(choices[0].id);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const choice = choices.find((c) => c.id === id) ?? choices[0];

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative aspect-4/5 w-full max-w-60 shrink-0 self-center overflow-hidden rounded-2xl border border-edge sm:self-auto">
        {!loaded[choice.id] && (
          <Skeleton className="absolute inset-0 rounded-2xl" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={choice.id}
          src={choice.src}
          alt={`Share card, ${choice.label} style`}
          width={1080}
          height={1350}
          className="relative size-full object-cover"
          onLoad={() => setLoaded((l) => ({ ...l, [choice.id]: true }))}
        />
      </div>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 w-full text-center text-sm font-bold text-ink">
            Style
          </legend>
          {/* Same width as the buttons below, one equal column each. */}
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))`,
            }}
          >
            {choices.map((c) => (
              <label
                key={c.id}
                className={cx(
                  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-bold transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand",
                  c.id === id
                    ? "border-brand bg-brand text-on-brand"
                    : "border-edge bg-surface text-ink hover:border-brand",
                )}
              >
                <input
                  type="radio"
                  name={`card-style-${fileName}`}
                  value={c.id}
                  checked={c.id === id}
                  onChange={() => setId(c.id)}
                  className="sr-only"
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <a
            href={choice.download}
            download={`${fileName}.png`}
            className={button({ fullWidth: true })}
          >
            Download card
          </a>
          {(choice.apple || choice.google) && (
            <div className="grid grid-cols-2 gap-2">
              {choice.apple && (
                <a
                  href={choice.apple}
                  aria-label="Add to Apple Wallet"
                  className={cx(
                    button({ variant: "secondary", size: "sm" }),
                    "whitespace-nowrap",
                    // Alone, it takes the whole row.
                    !choice.google && "col-span-2",
                  )}
                >
                  <WalletIcon />
                  Apple Wallet
                </a>
              )}
              {choice.google && (
                <a
                  href={choice.google}
                  target="_blank"
                  rel="noopener"
                  aria-label="Add to Google Wallet"
                  className={cx(
                    button({ variant: "secondary", size: "sm" }),
                    "whitespace-nowrap",
                    !choice.apple && "col-span-2",
                  )}
                >
                  <WalletIcon />
                  Google Wallet
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A button that opens the share card in a pop-up, for tracking links. */
export function ShareCardDialog({
  label,
  choices,
  fileName,
}: {
  label: string;
  choices: CardChoice[];
  fileName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = `card-${fileName}`;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={`QR code for ${label}`}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        QR code
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-edge bg-surface p-6 text-ink backdrop:bg-ink/40"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Heading as="h2" size="label" id={titleId}>
                Share card for &ldquo;{label}&rdquo;
              </Heading>
              <p className="text-sm text-ink-muted">
                Visits from this card count for {label} in Analytics.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => dialog.current?.close()}
            >
              Close
            </Button>
          </div>
          {/* Only load the pictures once someone opens it. */}
          {open && <ShareCardPicker choices={choices} fileName={fileName} />}
        </div>
      </dialog>
    </>
  );
}
