"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/browser";
import { displaySocial, SOCIAL_PLATFORMS, type Socials } from "@/lib/socials";
import {
  addLink,
  claimUsername,
  setAvatar,
  updateSocials,
  type FormState,
} from "./actions";

const input =
  "rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900";
const button =
  "rounded-lg bg-black px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black";

export function ClaimUsernameForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    claimUsername,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex items-center gap-1 text-lg">
        <span className="text-neutral-500">biolyn.link/</span>
        <input name="username" required className={`${input} flex-1`} />
      </label>
      <button disabled={pending} className={button}>
        {pending ? "Claiming..." : "Claim username"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function AddLinkForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await addLink(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    {},
  );
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input name="title" placeholder="Title" required className={input} />
      <input
        name="url"
        placeholder="https://..."
        required
        className={input}
      />
      <button disabled={pending} className={button}>
        {pending ? "Adding..." : "Add link"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function SocialsForm({ socials }: { socials: Socials }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateSocials,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      {SOCIAL_PLATFORMS.map((p) => (
        <label key={p.id} className="flex items-center gap-2">
          <span className="w-24 text-sm text-neutral-500">{p.label}</span>
          <input
            name={p.id}
            defaultValue={displaySocial(p.id, socials[p.id])}
            placeholder={p.id === "email" ? "you@example.com" : "@handle or URL"}
            className={`${input} flex-1`}
          />
        </label>
      ))}
      <button disabled={pending} className={`${button} self-start`}>
        {pending ? "Saving..." : "Save socials"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !pending && (
        <p className="text-sm text-green-600">Saved.</p>
      )}
    </form>
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
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 text-xl font-bold text-neutral-600">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="cursor-pointer text-sm underline">
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
          <button
            type="button"
            onClick={() => startTransition(() => setAvatar(null))}
            className="self-start text-sm text-neutral-500 underline"
          >
            Remove
          </button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
