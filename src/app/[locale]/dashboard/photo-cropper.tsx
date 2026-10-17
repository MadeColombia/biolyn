"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import {
  clampOffset,
  clampZoom,
  coverScale,
  CROP_SIZES,
  MAX_TILT,
  MAX_ZOOM,
  pinchZoom,
  stepTilt,
  stepZoom,
  type Point,
  type Size,
} from "@/lib/crop";
import { COVER_FADE, type PhotoStyle } from "@/lib/themes";

/**
 * Lets the user frame a picture before it uploads, like a phone's photo
 * editor: drag to move, pinch or scroll to zoom, and tap buttons to zoom,
 * turn a quarter or straighten a degree at a time (hold to keep going).
 * Saves a JPEG the size the picture style needs (see CROP_SIZES).
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
  const t = useTranslations("cropper");
  const common = useTranslations("common");
  const frame = CROP_SIZES[style];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  // Fingers (or the mouse) currently on the preview.
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
  // While the user adjusts, the preview shows a grid and what changed.
  const [readout, setReadout] = useState<string | null>(null);

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
      clearTimeout(hideTimer.current);
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

  // Mouse wheel and trackpad pinch zoom. React's onWheel can't stop the
  // page from scrolling, so this listener is added by hand.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => {
        const next = clampZoom(z * Math.exp(-e.deltaY * 0.002));
        show(`${Math.round(next * 100)}%`);
        return next;
      });
    };
    view.addEventListener("wheel", onWheel, { passive: false });
    return () => view.removeEventListener("wheel", onWheel);
  }, [bitmap]);

  const image: Size | null = bitmap
    ? { width: bitmap.width, height: bitmap.height }
    : null;
  const angle = turns * 90 + tilt;
  const scale = image ? coverScale(image, frame, angle) * zoom : 1;
  const clamp = (p: Point) =>
    image ? clampOffset(p, image, frame, angle, scale) : p;
  // Every change keeps the picture covering the frame.
  const shown = clamp(offset);

  function show(text: string, stay = false) {
    setReadout(text);
    clearTimeout(hideTimer.current);
    if (!stay) hideTimer.current = setTimeout(() => setReadout(null), 900);
  }

  function move(dx: number, dy: number) {
    setOffset((o) => clamp({ x: clamp(o).x + dx, y: clamp(o).y + dy }));
  }

  function changeZoom(direction: 1 | -1) {
    const next = stepZoom(zoom, direction);
    setZoom(next);
    show(`${Math.round(next * 100)}%`);
  }
  function changeTilt(direction: 1 | -1) {
    const next = stepTilt(tilt, direction);
    setTilt(next);
    show(`${next > 0 ? "+" : ""}${next}°`);
  }
  function turn(direction: 1 | -1) {
    setTurns((t) => (t + direction + 4) % 4);
    show(direction === 1 ? t("turnedRight") : t("turnedLeft"));
  }

  function spread() {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      pinch.current = { distance: spread(), zoom };
    }
    show("", true);
  }
  function onPointerMove(e: React.PointerEvent) {
    const last = pointers.current.get(e.pointerId);
    if (!last || !k) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const next = pinchZoom(
        pinch.current.zoom,
        pinch.current.distance,
        spread(),
      );
      setZoom(next);
      show(`${Math.round(next * 100)}%`, true);
    } else if (pointers.current.size === 1) {
      move((e.clientX - last.x) / k, (e.clientY - last.y) / k);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) show(readout ?? "");
  }
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 50 : 10;
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key === "+" || e.key === "=") changeZoom(1);
    else if (e.key === "-") changeZoom(-1);
    else if (keys[e.key]) move(...keys[e.key]);
    else return;
    e.preventDefault();
  }

  function reset() {
    setTurns(0);
    setTilt(0);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    show(t("backToStart"));
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

  const ready = Boolean(bitmap) && !failed;
  const round = style === "round";
  const changed =
    turns !== 0 || tilt !== 0 || zoom !== 1 || shown.x !== 0 || shown.y !== 0;

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
            {t("title")}
          </h2>
          <p className="text-sm text-ink-soft">
            {t("help")}
          </p>
        </div>

        {failed ? (
          <p role="alert" className="text-sm text-danger">
            {t("failed")}
          </p>
        ) : (
          <div
            className="relative mx-auto w-full min-w-40"
            style={{
              // Small enough that the whole dialog fits on short phones.
              maxWidth: `min(18rem, calc((100dvh - 22rem) * ${frame.width / frame.height}))`,
            }}
          >
            <div
              ref={viewRef}
              tabIndex={0}
              role="img"
              aria-label={t("preview")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              style={{
                aspectRatio: `${frame.width} / ${frame.height}`,
                // Cover photos fade out at the bottom on the public page, so
                // the preview shows the same fade.
                ...(!round && {
                  maskImage: COVER_FADE,
                  WebkitMaskImage: COVER_FADE,
                }),
              }}
              className={`relative w-full cursor-grab touch-none overflow-hidden bg-raised select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand active:cursor-grabbing ${
                round ? "rounded-full" : "rounded-2xl"
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
              <Grid visible={readout !== null} />
            </div>
            {readout && (
              <p
                aria-live="polite"
                className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-sm font-bold text-canvas tabular-nums"
              >
                {readout}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="flex justify-center gap-2 sm:gap-3">
            <ToolGroup label={t("zoom")}>
              <ToolButton
                label={t("zoomOut")}
                onPress={() => changeZoom(-1)}
                disabled={!ready || zoom <= 1}
              >
                <MinusIcon />
              </ToolButton>
              <ToolButton
                label={t("zoomIn")}
                onPress={() => changeZoom(1)}
                disabled={!ready || zoom >= MAX_ZOOM}
              >
                <PlusIcon />
              </ToolButton>
            </ToolGroup>
            <ToolGroup label={t("turn")}>
              <ToolButton
                label={t("turnLeft")}
                onPress={() => turn(-1)}
                disabled={!ready}
                repeat={false}
              >
                <TurnIcon flip />
              </ToolButton>
              <ToolButton
                label={t("turnRight")}
                onPress={() => turn(1)}
                disabled={!ready}
                repeat={false}
              >
                <TurnIcon />
              </ToolButton>
            </ToolGroup>
            <ToolGroup label={t("straighten")}>
              <ToolButton
                label={t("tiltLeft")}
                onPress={() => changeTilt(-1)}
                disabled={!ready || tilt <= -MAX_TILT}
              >
                <TiltIcon flip />
              </ToolButton>
              <ToolButton
                label={t("tiltRight")}
                onPress={() => changeTilt(1)}
                disabled={!ready || tilt >= MAX_TILT}
              >
                <TiltIcon />
              </ToolButton>
            </ToolGroup>
          </div>

          <button
            type="button"
            onClick={reset}
            // Hidden, not removed, so the layout doesn't jump.
            className={`rounded-lg px-2 py-1 text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand ${
              changed ? "" : "invisible"
            }`}
          >
            {t("startOver")}
          </button>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {common("cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={!ready || saving}>
            {saving ? common("saving") : t("use")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/** Rule-of-thirds lines that help line the picture up while adjusting. */
function Grid({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {[1, 2].map((i) => (
        <span key={`v${i}`}>
          <span
            className="absolute inset-y-0 w-px bg-white/60"
            style={{ left: `${(i * 100) / 3}%` }}
          />
          <span
            className="absolute inset-x-0 h-px bg-white/60"
            style={{ top: `${(i * 100) / 3}%` }}
          />
        </span>
      ))}
    </div>
  );
}

function ToolGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col items-center gap-1"
    >
      <div className="flex gap-1 rounded-2xl bg-raised p-1">{children}</div>
      <span aria-hidden className="text-xs font-bold text-ink-soft">
        {label}
      </span>
    </div>
  );
}

/**
 * A square icon button. Holding it down keeps repeating the action, so a
 * long press zooms or straightens smoothly. Keyboard presses still work
 * through onClick.
 */
function ToolButton({
  label,
  onPress,
  disabled,
  repeat = true,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  repeat?: boolean;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Always call the latest onPress, which sees the latest zoom and tilt.
  const press = useRef(onPress);
  useEffect(() => {
    press.current = onPress;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  function stop() {
    clearTimeout(timer.current);
  }
  function start(e: React.PointerEvent) {
    if (e.button !== 0) return;
    press.current();
    if (!repeat) return;
    const tick = (delay: number) => {
      timer.current = setTimeout(() => {
        // Stop at the limit: a disabled button gets no pointerup.
        if (buttonRef.current?.disabled) return;
        press.current();
        tick(70);
      }, delay);
    };
    tick(400);
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // Pointer presses already ran in onPointerDown. A click with
      // detail 0 comes from the keyboard (Enter or Space).
      onClick={(e) => e.detail === 0 && onPress()}
      onContextMenu={(e) => e.preventDefault()}
      className="grid size-10 touch-manipulation place-items-center rounded-xl text-ink transition select-none hover:bg-edge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Icon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

function MinusIcon() {
  return (
    <Icon>
      <path d="M5 12h14" />
    </Icon>
  );
}

function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

function TurnIcon({ flip = false }: { flip?: boolean }) {
  return (
    <Icon className={flip ? "-scale-x-100" : undefined}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </Icon>
  );
}

// A slightly tilted photo frame, leaning the way the button turns it.
function TiltIcon({ flip = false }: { flip?: boolean }) {
  return (
    <Icon className={flip ? "-scale-x-100" : undefined}>
      <rect
        x="5"
        y="7"
        width="14"
        height="10"
        rx="2"
        transform="rotate(15 12 12)"
      />
      <path d="M3 21h18" strokeDasharray="2 3" />
    </Icon>
  );
}
