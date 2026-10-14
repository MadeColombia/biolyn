"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  clampOffset,
  coverScale,
  CROP_SIZES,
  MAX_ZOOM,
  type Point,
  type Size,
} from "@/lib/crop";
import { COVER_FADE, type PhotoStyle } from "@/lib/themes";

/**
 * Lets the user frame a picture before it uploads: drag to move, zoom,
 * turn a quarter at a time and straighten. Saves a JPEG the size the
 * picture style needs (see CROP_SIZES).
 */
export function PhotoCropper({
  file,
  style,
  onCancel,
  onDone,
}: {
  file: File;
  style: PhotoStyle;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const frame = CROP_SIZES[style];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [turns, setTurns] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  // Screen pixels per frame pixel, so the preview fits the dialog.
  const [k, setK] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    let cancelled = false;
    let url: string | null = null;
    createImageBitmap(file).then(
      (b) => {
        if (cancelled) return b.close();
        url = URL.createObjectURL(file);
        setSrc(url);
        setBitmap(b);
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const measure = () => setK(view.clientWidth / frame.width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    return () => observer.disconnect();
  }, [frame.width, bitmap]);

  const image: Size | null = bitmap
    ? { width: bitmap.width, height: bitmap.height }
    : null;
  const angle = turns * 90 + tilt;
  const scale = image ? coverScale(image, frame, angle) * zoom : 1;
  const clamp = (p: Point, a = angle, s = scale) =>
    image ? clampOffset(p, image, frame, a, s) : p;
  // Every change keeps the picture covering the frame.
  const shown = clamp(offset);

  function move(dx: number, dy: number) {
    setOffset((o) => clamp({ x: clamp(o).x + dx, y: clamp(o).y + dy }));
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !k) return;
    move((e.clientX - d.x) / k, (e.clientY - d.y) / k);
    drag.current = { id: d.id, x: e.clientX, y: e.clientY };
  }
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 50 : 10;
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = keys[e.key];
    if (!delta) return;
    e.preventDefault();
    move(...delta);
  }

  function reset() {
    setTurns(0);
    setTilt(0);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  async function save() {
    if (!bitmap || !image) return;
    setSaving(true);
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(frame.width / 2 + shown.x, frame.height / 2 + shown.y);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(bitmap, -image.width / 2, -image.height / 2);
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) onDone(blob);
        else setFailed(true);
      },
      "image/jpeg",
      0.88,
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cropper-title"
      // Escape closes the dialog: treat it like Cancel.
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(100%-2rem,26rem)] max-h-[calc(100dvh-1rem)] rounded-3xl border border-edge bg-surface p-5 text-ink sm:p-6 backdrop:bg-ink/60"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="cropper-title" className="font-display text-xl font-bold">
            Frame your picture
          </h2>
          <p className="text-sm text-ink-soft">
            Drag to move it. Use the sliders to zoom and straighten.
          </p>
        </div>

        {failed ? (
          <p role="alert" className="text-sm text-danger">
            Could not open that picture. Try a JPG or PNG.
          </p>
        ) : (
          <div
            ref={viewRef}
            tabIndex={0}
            role="img"
            aria-label="Picture preview. Use the arrow keys to move it."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onKeyDown={onKeyDown}
            style={{
              aspectRatio: `${frame.width} / ${frame.height}`,
              // Small enough that the whole dialog fits on short phones.
              maxWidth: `min(18rem, calc((100dvh - 24rem) * ${frame.width / frame.height}))`,
              // Cover photos fade out at the bottom on the public page, so
              // the preview shows the same fade.
              ...(style === "cover" && {
                maskImage: COVER_FADE,
                WebkitMaskImage: COVER_FADE,
              }),
            }}
            className={`relative mx-auto w-full min-w-40 cursor-grab touch-none overflow-hidden bg-raised select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand active:cursor-grabbing ${
              style === "round" ? "rounded-full" : "rounded-2xl"
            }`}
          >
            {src && image && k > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  width: image.width,
                  height: image.height,
                  transform: `translate(-50%, -50%) translate(${shown.x * k}px, ${shown.y * k}px) rotate(${angle}deg) scale(${scale * k})`,
                }}
                className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
              />
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Slider
            id="crop-zoom"
            label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={setZoom}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            id="crop-tilt"
            label="Straighten"
            min={-45}
            max={45}
            step={0.5}
            value={tilt}
            onChange={setTilt}
            format={(v) => `${v > 0 ? "+" : ""}${v}°`}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setTurns((t) => (t + 3) % 4)}
            >
              <TurnIcon flip /> Turn left
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setTurns((t) => (t + 1) % 4)}
            >
              <TurnIcon /> Turn right
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!bitmap || saving || failed}
          >
            {saving ? "Saving..." : "Use picture"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function Slider({
  id,
  label,
  format,
  onChange,
  value,
  ...props
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <label htmlFor={id} className="font-bold text-ink">
          {label}
        </label>
        <span className="text-ink-muted tabular-nums">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand"
        {...props}
      />
    </div>
  );
}

function TurnIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={flip ? "-scale-x-100" : undefined}
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}
