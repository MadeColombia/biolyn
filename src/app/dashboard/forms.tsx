"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Input, Field, button, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { displaySocial, SOCIAL_PLATFORMS, type Socials } from "@/lib/socials";
import {
  addLink,
  claimUsername,
  setAvatar,
  updateSocials,
  type FormState,
} from "./actions";
import { LinkForm } from "./link-form";

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

export function AddLinkForm({ userId }: { userId: string }) {
  // A new key after each save gives a fresh, empty form.
  const [round, setRound] = useState(0);
  return (
    <LinkForm
      key={round}
      userId={userId}
      action={addLink}
      submitLabel="Add link"
      pendingLabel="Adding..."
      onSaved={() => setRound((n) => n + 1)}
    />
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
export function CopyLinkButton({ url }: { url: string }) {
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
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

// Crops the picture to a centered square and shrinks it to 512px JPEG,
// so phone photos upload fast and stay under the 2 MB bucket limit.
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(512, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.85,
    ),
  );
}

export function AvatarUpload({
  userId,
  avatarUrl,
  name,
}: {
  userId: string;
  avatarUrl: string | null;
  name: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const blob = await toSquareJpeg(file);
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

  return (
    <div className="flex items-center gap-4">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-20 w-20 shrink-0 rounded-full border border-edge object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-raised font-display text-2xl font-bold text-ink-soft">
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
            {pending ? "Uploading..." : "Change picture"}
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
  );
}
