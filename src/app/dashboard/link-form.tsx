"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Field, button, cx } from "@/components/ui";
import { embedFor } from "@/lib/embeds";
import { createClient } from "@/lib/supabase/browser";
import { LINK_IMAGES_BUCKET, type LinkSize } from "@/lib/link-form";
import type { FormState } from "./actions";

export type EditableLink = {
  id: string;
  title: string;
  url: string;
  embed: boolean;
  size: LinkSize;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

const SERVICE_NAME = {
  youtube: "a YouTube",
  spotify: "a Spotify",
  apple: "an Apple Music",
};

// A saved ISO time as the value a datetime-local input wants
// ("2026-10-14T18:30"), in this browser's time zone.
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Crops the picture to a centered 16:9 box and shrinks it to at most
// 1200px wide JPEG, so it fits the big button and loads fast.
async function toWideJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = 16 / 9;
  let sw = bitmap.width;
  let sh = sw / ratio;
  if (sh > bitmap.height) {
    sh = bitmap.height;
    sw = sh * ratio;
  }
  const width = Math.round(Math.min(1200, sw));
  const height = Math.round(width / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext("2d")!
    .drawImage(
      bitmap,
      (bitmap.width - sw) / 2,
      (bitmap.height - sh) / 2,
      sw,
      sh,
      0,
      0,
      width,
      height,
    );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.85,
    ),
  );
}

/**
 * The add and edit link form. `link` fills it in for editing; without
 * it the form starts empty. `onSaved` runs after a successful save.
 */
export function LinkForm({
  userId,
  link,
  action,
  submitLabel,
  pendingLabel,
  onSaved,
  onCancel,
}: {
  userId: string;
  link?: EditableLink;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const idPrefix = link ? `link-${link.id}` : "link-new";
  const [url, setUrl] = useState(link?.url ?? "");
  const embed = embedFor(url.trim());
  const [asPlayer, setAsPlayer] = useState(link ? link.embed : true);
  const [size, setSize] = useState<LinkSize>(link?.size ?? "small");
  const [imageUrl, setImageUrl] = useState(link?.image_url ?? null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const hasSchedule = Boolean(link?.starts_at || link?.ends_at);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      // datetime-local values have no time zone; turn them into exact
      // moments using this browser's zone before sending.
      for (const [local, field] of [
        ["starts_local", "starts_at"],
        ["ends_local", "ends_at"],
      ]) {
        const value = formData.get(local);
        if (typeof value === "string" && value) {
          formData.set(field, new Date(value).toISOString());
        }
      }
      const result = await action(prev, formData);
      if (!result.error) onSaved?.();
      return result;
    },
    {},
  );

  function onPicture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageError(null);
    startUpload(async () => {
      try {
        const blob = await toWideJpeg(file);
        const supabase = createClient();
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(LINK_IMAGES_BUCKET)
          .upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const { data } = supabase.storage
          .from(LINK_IMAGES_BUCKET)
          .getPublicUrl(path);
        setImageUrl(data.publicUrl);
      } catch {
        setImageError("Could not upload that picture. Try a JPG or PNG.");
      }
    });
  }

  const showsPlayer = Boolean(embed) && asPlayer;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Fields marked <span className="text-danger">*</span> are required.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-title`}
          label="Title"
          name="title"
          placeholder="My shop"
          maxLength={80}
          defaultValue={link?.title}
          required
        />
        <Field
          id={`${idPrefix}-url`}
          label="URL"
          name="url"
          type="text"
          inputMode="url"
          placeholder="https://..."
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      {/* Always mounted so screen readers announce the detected link. */}
      <div role="status" aria-live="polite" className="empty:hidden">
        {embed && (
          <div className="flex flex-col gap-2 rounded-xl border border-edge bg-raised p-3">
            <p className="text-sm font-bold text-success">
              This is {SERVICE_NAME[embed.kind]} link!
            </p>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="embed"
                checked={asPlayer}
                onChange={(e) => setAsPlayer(e.target.checked)}
                className="size-4 accent-brand"
              />
              Show it as a player on your page
            </label>
          </div>
        )}
      </div>

      {showsPlayer ? (
        // A player has its own size, but keep the choice for later.
        <input type="hidden" name="size" value={size} />
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-bold text-ink">
            Button size
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {(["small", "big"] as const).map((option) => (
              <label
                key={option}
                className={cx(
                  "flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
                  size === option
                    ? "border-brand bg-raised"
                    : "border-edge bg-surface hover:bg-raised",
                )}
              >
                <input
                  type="radio"
                  name="size"
                  value={option}
                  checked={size === option}
                  onChange={() => setSize(option)}
                  className="sr-only"
                />
                {/* A tiny picture of the button. */}
                <span
                  aria-hidden
                  className="flex h-16 items-center justify-center"
                >
                  {option === "small" ? (
                    <span className="h-4 w-full rounded-md border border-edge bg-canvas" />
                  ) : (
                    <span className="flex h-full w-3/4 flex-col gap-1 rounded-lg border border-edge bg-canvas p-1">
                      <span className="flex-1 rounded bg-line" />
                      <span className="mx-auto h-1.5 w-1/2 rounded bg-ink-muted" />
                    </span>
                  )}
                </span>
                <span className="text-sm font-bold text-ink">
                  {option === "small" ? "Small" : "Big"}
                </span>
                <span className="text-xs text-ink-muted">
                  {option === "small"
                    ? "A one-line button."
                    : "A card with a picture."}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {!showsPlayer && size === "big" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-ink">Picture</p>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="aspect-video w-full max-w-sm rounded-xl border border-edge object-cover"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cx(
                button({ variant: "secondary", size: "sm" }),
                "cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
                uploading && "opacity-50",
              )}
            >
              {uploading
                ? "Uploading..."
                : imageUrl
                  ? "Change picture"
                  : "Add picture"}
              <input
                type="file"
                accept="image/*"
                onChange={onPicture}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            {imageUrl && !uploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImageUrl(null)}
              >
                Remove picture
              </Button>
            )}
          </div>
          <p className="text-sm text-ink-muted">
            Optional. It&apos;s cropped to a wide 16:9 shape.
          </p>
          {imageError && <p className="text-sm text-danger">{imageError}</p>}
        </div>
      )}
      {/* Kept even when hidden, so switching sizes doesn't lose it. */}
      <input type="hidden" name="image_url" value={imageUrl ?? ""} />

      <details open={hasSchedule} className="group">
        <summary className="cursor-pointer text-sm font-bold text-ink">
          Schedule (optional)
        </summary>
        <div className="grid gap-4 pt-3 sm:grid-cols-2">
          <Field
            id={`${idPrefix}-starts`}
            label="Show from"
            name="starts_local"
            type="datetime-local"
            defaultValue={toLocalInput(link?.starts_at ?? null)}
          />
          <Field
            id={`${idPrefix}-ends`}
            label="Hide after"
            name="ends_local"
            type="datetime-local"
            defaultValue={toLocalInput(link?.ends_at ?? null)}
          />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || uploading}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
