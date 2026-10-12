"use client";

import { useActionState, useRef } from "react";
import { addLink, claimUsername, type FormState } from "./actions";

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
