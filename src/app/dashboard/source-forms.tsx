"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Field } from "@/components/ui";
import { cleanSource } from "@/lib/sources";
import { addSource, type FormState } from "./actions";

/** Name a new tracking link; the code follows the name unless typed. */
export function AddSourceForm({ full }: { full: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await addSource(prev, formData);
      if (result.saved) {
        formRef.current?.reset();
        setName("");
      }
      return result;
    },
    {},
  );
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          name="label"
          required
          maxLength={40}
          placeholder="TikTok, Newsletter, Flyer..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="Code"
          name="code"
          maxLength={30}
          placeholder={cleanSource(name) ?? "tiktok"}
          hint="Goes after ?s= in the address. Leave it empty to use the name."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || full}>
          {pending ? "Creating..." : "Create link"}
        </Button>
        {full && (
          <p className="text-sm text-ink-muted">
            You have the most tracking links. Delete one to add another.
          </p>
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
