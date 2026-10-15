"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Button, Input, Field, button, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { displaySocial, SOCIAL_PLATFORMS, type Socials } from "@/lib/socials";
import {
  claimUsername,
  updateProfile,
  setAvatar,
  setPhotoStyle,
  updateSocials,
  type FormState,
} from "./actions";
import { PHOTO_STYLES, type PhotoStyle } from "@/lib/themes";
import { PhotoCropper } from "./photo-cropper";
import { BioEditor } from "./bio-editor";

export function ClaimUsernameForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    claimUsername,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="field-username" className="text-sm font-bold text-ink">
          Username
        </label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-lg font-semibold text-ink-muted">
            biolyn.link/
          </span>
          <Input
            id="field-username"
            name="username"
            required
            placeholder="yourname"
            invalid={Boolean(state.error)}
            aria-describedby={state.error ? "field-username-note" : undefined}
            className="min-w-0 flex-1 text-lg font-semibold"
          />
        </div>
        {state.error && (
          <p id="field-username-note" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
      <Button disabled={pending} size="lg" fullWidth>
        {pending ? "Claiming..." : "Claim username"}
      </Button>
    </form>
  );
}

export function ProfileForm({
  displayName,
  bio,
}: {
  displayName: string;
  bio: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateProfile,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Display name"
        name="display_name"
        defaultValue={displayName}
        placeholder="Display name"
      />
      <BioEditor defaultValue={bio} />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending}>
          {pending ? "Saving..." : "Save profile"}
        </Button>
        <p role="status" className="text-sm">
          {state.error ? (
            <span className="text-danger">{state.error}</span>
          ) : (
            state.saved && !pending && <span className="text-success">Saved.</span>
          )}
        </p>
      </div>
    </form>
  );
}

export function SocialsForm({ socials }: { socials: Socials }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateSocials,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <Field
            key={p.id}
            id={`social-${p.id}`}
            label={p.label}
            name={p.id}
            defaultValue={displaySocial(p.id, socials[p.id])}
            placeholder={
              p.id === "email" ? "you@example.com" : "@handle or URL"
            }
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending}>
          {pending ? "Saving..." : "Save socials"}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.saved && !pending && (
          <p role="status" className="text-sm font-bold text-success">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}

/** Copies the public link, then says so for a moment. */
export function CopyLinkButton({
  url,
  label = "Copy link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (old browser, no permission): the link is still
      // there to open or select by hand.
    }
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={copy}
      aria-live="polite"
      className="shrink-0"
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

const PHOTO_STYLE_HINTS: Record<PhotoStyle, string> = {
  round: "A small round picture above your name.",
  cover: "A big photo across the top that fades into your page.",
};

export function AvatarUpload({
  userId,
  avatarUrl,
  name,
  photoStyle,
}: {
  userId: string;
  avatarUrl: string | null;
  name: string;
  photoStyle: PhotoStyle;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The picture being framed in the cropper, before it uploads.
  const [file, setFile] = useState<File | null>(null);
  // Shows the new style right away while it saves.
  const [style, setStyle] = useOptimistic(photoStyle);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);
    setFile(picked);
  }

  function upload(blob: Blob) {
    setFile(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        await setAvatar(data.publicUrl);
      } catch {
        setError("Could not upload that picture. Try a JPG or PNG.");
      }
    });
  }

  function pickStyle(next: PhotoStyle) {
    startTransition(async () => {
      setStyle(next);
      await setPhotoStyle(next);
    });
  }

  const thumb =
    style === "cover"
      ? "h-25 w-20 rounded-2xl"
      : "h-20 w-20 rounded-full";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className={cx(thumb, "shrink-0 border border-edge object-cover")}
          />
        ) : (
          <div
            className={cx(
              thumb,
              "flex shrink-0 items-center justify-center bg-raised font-display text-2xl font-bold text-ink-soft",
            )}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label
              className={cx(
                button({ variant: "secondary", size: "sm" }),
                "cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
                pending && "opacity-50",
              )}
            >
              {pending ? "Saving..." : "Change picture"}
              <input
                type="file"
                accept="image/*"
                onChange={onChange}
                disabled={pending}
                className="sr-only"
              />
            </label>
            {avatarUrl && !pending && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => startTransition(() => setAvatar(null))}
              >
                Remove
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-bold text-ink">
          Picture style
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(PHOTO_STYLES) as PhotoStyle[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === style}
              onClick={() => id !== style && pickStyle(id)}
              className={cx(
                "flex items-center gap-3 rounded-2xl border border-edge bg-surface p-3 text-left transition hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                id === style &&
                  "ring-2 ring-brand ring-offset-2 ring-offset-surface",
              )}
            >
              <StyleSketch style={id} />
              <span className="text-sm font-bold text-ink">
                {PHOTO_STYLES[id].label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-muted">{PHOTO_STYLE_HINTS[style]}</p>
        {style === "cover" && avatarUrl && (
          <p className="text-sm text-ink-muted">
            Tip: choose your picture again to frame it for the tall cover
            shape.
          </p>
        )}
      </fieldset>

      {file && (
        <PhotoCropper
          file={file}
          style={style}
          onCancel={() => setFile(null)}
          onDone={upload}
        />
      )}
    </div>
  );
}

/** A tiny drawing of each picture style for the picker. */
function StyleSketch({ style }: { style: PhotoStyle }) {
  return (
    <span
      aria-hidden
      className="flex h-14 w-11 shrink-0 flex-col items-center gap-1 overflow-hidden rounded-lg border border-edge bg-canvas"
    >
      {style === "cover" ? (
        <span className="h-7 w-full bg-linear-to-b from-ink-muted to-transparent" />
      ) : (
        <span className="mt-2 h-4 w-4 rounded-full bg-ink-muted" />
      )}
      <span className="h-1 w-6 rounded bg-ink-soft" />
      <span className="h-1 w-8 rounded bg-raised" />
      <span className="h-1 w-8 rounded bg-raised" />
    </span>
  );
}
