"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, button, cx, input } from "@/components/ui";
import { embedFor } from "@/lib/embeds";
import { createClient } from "@/lib/supabase/browser";
import {
  isIconPreview,
  LINK_IMAGES_BUCKET,
  type LinkSize,
} from "@/lib/link-form";
import type { SectionLayout } from "@/lib/sections";
import { discardLinkImage, loadPreview, type FormState } from "./actions";

/** A section the link can go in, for the form's Section choice. */
export type SectionOption = {
  id: string;
  title: string | null;
  layout: SectionLayout;
};

export type EditableLink = {
  id: string;
  title: string;
  url: string;
  embed: boolean;
  size: LinkSize;
  image_url: string | null;
  preview_url?: string | null;
  starts_at: string | null;
  ends_at: string | null;
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
 * With `sections` the form asks which section the link goes in, starting
 * at `sectionId` (null is the main list).
 */
export function LinkForm({
  userId,
  link,
  sections = [],
  sectionId: initialSection = null,
  action,
  submitLabel,
  pendingLabel,
  onSaved,
  onCancel,
}: {
  userId: string;
  link?: EditableLink;
  sections?: SectionOption[];
  sectionId?: string | null;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("linkForm");
  const list = useTranslations("linkList");
  const sectionT = useTranslations("sectionForm");
  const common = useTranslations("common");
  const idPrefix = link ? `link-${link.id}` : "link-new";
  const [url, setUrl] = useState(link?.url ?? "");
  const embed = embedFor(url.trim());
  const [asPlayer, setAsPlayer] = useState(link ? link.embed : true);
  const [size, setSize] = useState<LinkSize>(link?.size ?? "small");
  const [sectionId, setSectionId] = useState(initialSection ?? "");
  // In a carousel every link is a card with a picture, so the size
  // choice doesn't apply and the picture is always offered.
  const inCarousel =
    sections.find((s) => s.id === sectionId)?.layout === "carousel";
  const [imageUrl, setImageUrl] = useState(link?.image_url ?? null);
  // The preview belongs to the URL it was made for.
  const [preview, setPreview] = useState(
    link?.preview_url ? { url: link.url, src: link.preview_url } : null,
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [previewing, startPreview] = useTransition();
  // Pictures made in this form that aren't saved yet, so the ones the
  // user replaces or cancels can be deleted instead of left behind.
  const unsaved = useRef(new Set<string>());

  function drop(src: string | null | undefined) {
    if (src && unsaved.current.delete(src)) void discardLinkImage(src);
  }
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
      if (!result.error) {
        // Anything made here but not saved with the link is deleted.
        const kept = [formData.get("image_url"), formData.get("preview_url")];
        for (const src of unsaved.current) {
          if (!kept.includes(src)) void discardLinkImage(src);
        }
        unsaved.current.clear();
        onSaved?.();
      }
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
        unsaved.current.add(data.publicUrl);
        drop(imageUrl);
        drop(preview?.src);
        setImageUrl(data.publicUrl);
        setPreview(null);
      } catch {
        setImageError(common("uploadFailed"));
      }
    });
  }

  function onLoadPreview() {
    const target = url.trim();
    setImageError(null);
    startPreview(async () => {
      const result = await loadPreview(target);
      if (!result.preview_url) {
        setImageError(result.error ?? t("previewFailed"));
        return;
      }
      unsaved.current.add(result.preview_url);
      drop(imageUrl);
      drop(preview?.src);
      setImageUrl(null);
      setPreview({ url: target, src: result.preview_url });
    });
  }

  function onRemovePicture() {
    drop(imageUrl);
    drop(preview?.src);
    setImageUrl(null);
    setPreview(null);
  }

  function onCancel_() {
    for (const src of unsaved.current) void discardLinkImage(src);
    unsaved.current.clear();
    onCancel?.();
  }

  const showsPlayer = Boolean(embed) && asPlayer && !inCarousel;
  // A preview made for another URL no longer matches the link.
  const currentPreview =
    preview && preview.url === url.trim() ? preview.src : null;
  const shownPicture = imageUrl ?? currentPreview;
  const busy = uploading || previewing;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        {common.rich("requiredNote", {
          star: (chunks) => <span className="text-danger">{chunks}</span>,
        })}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-title`}
          label={t("title")}
          name="title"
          placeholder={t("titlePlaceholder")}
          maxLength={80}
          defaultValue={link?.title}
          required
        />
        <Field
          id={`${idPrefix}-url`}
          label={t("url")}
          name="url"
          type="text"
          inputMode="url"
          placeholder="https://..."
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      {sections.length > 0 && (
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`${idPrefix}-section`}
            className="text-sm font-bold text-ink"
          >
            {t("section")}
          </label>
          <span className="relative">
            <select
              id={`${idPrefix}-section`}
              name="section_id"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className={input({ select: true })}
            >
              <option value="">{t("noSection")}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title ?? list("untitled")}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>
      )}

      {/* Always mounted so screen readers announce the detected link. */}
      <div role="status" aria-live="polite" className="empty:hidden">
        {embed && (
          <div className="flex flex-col gap-2 rounded-xl border border-edge bg-raised p-3">
            <p className="text-sm font-bold text-success">
              {t("detected", { service: embed.kind })}
            </p>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="embed"
                checked={asPlayer}
                onChange={(e) => setAsPlayer(e.target.checked)}
                className="size-4 accent-brand"
              />
              {t("asPlayer")}
            </label>
          </div>
        )}
      </div>

      {showsPlayer || inCarousel ? (
        // A player or a card has its own size, but keep the choice for
        // later.
        <input type="hidden" name="size" value={size} />
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-bold text-ink">
            {t("size")}
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
                  {option === "small" ? t("small") : t("big")}
                </span>
                <span className="text-xs text-ink-muted">
                  {option === "small" ? t("smallHint") : t("bigHint")}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {inCarousel && (
        <p className="text-sm text-ink-muted">{sectionT("carouselTip")}</p>
      )}
      {!showsPlayer && (size === "big" || inCarousel) && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-ink">{t("picture")}</p>
          {shownPicture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownPicture}
              alt=""
              referrerPolicy="no-referrer"
              className={cx(
                "aspect-video w-full max-w-sm rounded-xl border border-edge",
                isIconPreview(shownPicture)
                  ? "bg-raised object-contain p-8"
                  : "object-cover",
              )}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cx(
                button({ variant: "secondary", size: "sm" }),
                "cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
                busy && "pointer-events-none opacity-50",
              )}
            >
              {uploading
                ? t("uploading")
                : imageUrl
                  ? t("changePicture")
                  : t("uploadPicture")}
              <input
                type="file"
                accept="image/*"
                onChange={onPicture}
                disabled={busy}
                className="sr-only"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !url.trim() || currentPreview !== null}
              onClick={onLoadPreview}
            >
              {previewing ? t("gettingPreview") : t("usePreview")}
            </Button>
            {shownPicture && !busy && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemovePicture}
              >
                {t("removePicture")}
              </Button>
            )}
          </div>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {previewing
              ? t("previewWait")
              : imageUrl
                ? t("cropped")
                : currentPreview
                  ? isIconPreview(currentPreview)
                    ? t("iconUsed")
                    : t("isPreview")
                  : t("pictureHint")}
          </p>
          {imageError && <p className="text-sm text-danger">{imageError}</p>}
        </div>
      )}
      {/* Kept even when hidden, so switching sizes doesn't lose it. */}
      <input type="hidden" name="image_url" value={imageUrl ?? ""} />
      <input type="hidden" name="preview_url" value={currentPreview ?? ""} />

      <details open={hasSchedule} className="group">
        <summary className="cursor-pointer text-sm font-bold text-ink">
          {t("schedule")}
        </summary>
        <div className="grid gap-4 pt-3 sm:grid-cols-2">
          <Field
            id={`${idPrefix}-starts`}
            label={t("showFrom")}
            name="starts_local"
            type="datetime-local"
            defaultValue={toLocalInput(link?.starts_at ?? null)}
          />
          <Field
            id={`${idPrefix}-ends`}
            label={t("hideAfter")}
            name="ends_local"
            type="datetime-local"
            defaultValue={toLocalInput(link?.ends_at ?? null)}
          />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || busy}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel_}>
            {common("cancel")}
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
