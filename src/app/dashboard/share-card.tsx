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
};

/**
 * Preview of the share card with a style picker and a Download button.
 * The pictures are drawn on the server (see /api/qr-card).
 */
export function ShareCardPicker({
  choices,
  fileName,
  qrPng,
}: {
  choices: CardChoice[];
  fileName: string;
  /** The plain QR code, for printing on its own. */
  qrPng?: string;
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

      <div className="flex flex-col items-start gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold text-ink">Style</legend>
          <div className="flex flex-wrap gap-2">
            {choices.map((c) => (
              <label
                key={c.id}
                className={cx(
                  "inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-bold transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand",
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

        <div className="flex flex-wrap gap-2">
          <a
            href={choice.download}
            download={`${fileName}.png`}
            className={button({ size: "sm" })}
          >
            Download card
          </a>
          {qrPng && (
            <a
              href={qrPng}
              download={`${fileName}-qr.png`}
              className={button({ variant: "secondary", size: "sm" })}
            >
              QR code only
            </a>
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
  qrPng,
}: {
  label: string;
  choices: CardChoice[];
  fileName: string;
  qrPng: string;
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
          {open && (
            <ShareCardPicker
              choices={choices}
              fileName={fileName}
              qrPng={qrPng}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
