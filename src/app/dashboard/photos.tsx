"use client";

import { useState, useTransition } from "react";
import { Button, button, cx, input } from "@/components/ui";
import {
  MAX_ALT_LENGTH,
  MAX_PHOTOS,
  type GalleryLayout,
} from "@/lib/gallery";
import { createClient } from "@/lib/supabase/browser";
import {
  addPhoto,
  deletePhoto,
  reorderPhotos,
  setGalleryLayout,
  updatePhotoAlt,
} from "./actions";

type Photo = { id: string; url: string; alt: string };

// Shrinks a photo so its longest side is at most 1600px and saves it as
// JPEG. Phone photos (often 5 MB or more) end up around 200 to 500 KB.
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.85,
    ),
  );
}

const LAYOUTS: { id: GalleryLayout; label: string; hint: string }[] = [
  { id: "carousel", label: "Carousel", hint: "Swipe one by one" },
  { id: "grid", label: "Grid", hint: "All at once" },
];

// The parent gives this a `key` built from the server data, so it starts
// fresh whenever the saved photos change.
export function PhotoManager({
  userId,
  layout: savedLayout,
  photos: initial,
}: {
  userId: string;
  layout: GalleryLayout;
  photos: Photo[];
}) {
  const [photos, setPhotos] = useState(initial);
  const [layout, setLayout] = useState(savedLayout);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const free = MAX_PHOTOS - photos.length;

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    const batch = files.slice(0, free);
    startTransition(async () => {
      const supabase = createClient();
      let failed = 0;
      for (const [i, file] of batch.entries()) {
        setProgress(`Uploading ${i + 1} of ${batch.length}...`);
        try {
          const blob = await toJpeg(file);
          const path = `${userId}/${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("photos")
            .upload(path, blob, { contentType: "image/jpeg" });
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from("photos").getPublicUrl(path);
          const result = await addPhoto(data.publicUrl, "");
          if (result.error) {
            setError(result.error);
            break;
          }
        } catch {
          failed++;
        }
      }
      setProgress(null);
      if (failed > 0) {
        setError(
          failed === 1
            ? "One photo could not be uploaded. Try a JPG or PNG."
            : `${failed} photos could not be uploaded. Try JPG or PNG files.`,
        );
      } else if (files.length > batch.length) {
        setError(`Only ${MAX_PHOTOS} photos fit, so some were left out.`);
      }
    });
  }

  function move(index: number, by: -1 | 1) {
    const next = [...photos];
    const [photo] = next.splice(index, 1);
    next.splice(index + by, 0, photo);
    setPhotos(next);
    startTransition(() => reorderPhotos(next.map((p) => p.id)));
  }

  function remove(id: string) {
    setPhotos(photos.filter((p) => p.id !== id));
    startTransition(() => deletePhoto(id));
  }

  function pickLayout(id: GalleryLayout) {
    setLayout(id);
    startTransition(() => setGalleryLayout(id));
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-ink">Show as</legend>
        <div className="grid grid-cols-2 gap-3">
          {LAYOUTS.map((l) => {
            const selected = l.id === layout;
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={selected}
                onClick={() => pickLayout(l.id)}
                className={cx(
                  "flex items-center gap-3 rounded-2xl border border-edge bg-surface p-3 text-left transition hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  selected &&
                    "border-brand ring-2 ring-brand ring-offset-2 ring-offset-surface",
                )}
              >
                <LayoutIcon layout={l.id} />
                <span className="flex flex-col">
                  <span className="font-bold text-ink">{l.label}</span>
                  <span className="text-sm text-ink-muted">{l.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cx(
            button({ variant: "primary", size: "md" }),
            "cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
            (pending || free === 0) && "pointer-events-none opacity-50",
          )}
        >
          {progress ?? "Add photos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={onFiles}
            disabled={pending || free === 0}
            className="sr-only"
          />
        </label>
        <p className="text-sm text-ink-muted">
          {photos.length} of {MAX_PHOTOS} photos
        </p>
        {error && (
          <p role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-raised px-4 py-8 text-center text-sm text-ink-muted">
          No photos yet. They show under your links.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {photos.map((photo, i) => (
            <li
              key={photo.id}
              className="flex flex-col gap-3 rounded-2xl border border-edge bg-surface p-3"
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  className="size-20 shrink-0 rounded-xl object-cover"
                />
                <label className="sr-only" htmlFor={`photo-alt-${photo.id}`}>
                  Description of photo {i + 1}
                </label>
                <input
                  id={`photo-alt-${photo.id}`}
                  defaultValue={photo.alt}
                  maxLength={MAX_ALT_LENGTH}
                  placeholder="Describe it (optional)"
                  onBlur={(e) => {
                    const alt = e.target.value;
                    if (alt !== photo.alt) {
                      setPhotos((all) =>
                        all.map((p) => (p.id === photo.id ? { ...p, alt } : p)),
                      );
                      startTransition(() => updatePhotoAlt(photo.id, alt));
                    }
                  }}
                  className={cx(input(), "h-10 min-w-0 flex-1 text-sm")}
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move photo ${i + 1} earlier`}
                >
                  ←
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={i === photos.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move photo ${i + 1} later`}
                >
                  →
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(photo.id)}
                  className="ml-auto text-danger"
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LayoutIcon({ layout }: { layout: GalleryLayout }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width="40"
      height="40"
      aria-hidden
      className="shrink-0 text-brand"
      fill="currentColor"
    >
      {layout === "carousel" ? (
        <>
          <rect x="9" y="6" width="22" height="24" rx="4" />
          <rect x="1" y="9" width="6" height="18" rx="2" opacity=".35" />
          <rect x="33" y="9" width="6" height="18" rx="2" opacity=".35" />
          <circle cx="15" cy="35" r="2" />
          <circle cx="20" cy="35" r="2" opacity=".35" />
          <circle cx="25" cy="35" r="2" opacity=".35" />
        </>
      ) : (
        <>
          {[4, 16, 28].flatMap((x) =>
            [4, 16, 28].map((y) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="9" height="9" rx="2" />
            )),
          )}
        </>
      )}
    </svg>
  );
}
