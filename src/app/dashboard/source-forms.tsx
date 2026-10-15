"use client";

import { useActionState, useRef } from "react";
import { Button, Field } from "@/components/ui";
import { addSource, type FormState } from "./actions";

/** Make a new tracking link from just a name. */
export function AddSourceForm({ full }: { full: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await addSource(prev, formData);
      if (result.saved) formRef.current?.reset();
      return result;
    },
    {},
  );
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <Field
        label="Where will you share it?"
        name="label"
        required
        maxLength={40}
        placeholder="TikTok bio, Newsletter, Flyer..."
      />
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
