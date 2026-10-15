"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Field, Heading } from "@/components/ui";
import { addSource, deleteSource, type FormState } from "./actions";

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

/**
 * Delete asks first: after deleting, people who still use the link count
 * as "Direct or unknown". Past visits keep the link's name.
 */
export function DeleteSource({ id, label }: { id: string; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        aria-label={`Delete ${label}`}
        onClick={() => dialog.current?.showModal()}
      >
        Delete
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`delete-${id}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-edge bg-surface p-6 text-ink backdrop:bg-ink/40"
      >
        <div className="flex flex-col gap-4">
          <Heading as="h2" size="label" id={`delete-${id}`}>
            Delete &ldquo;{label}&rdquo;?
          </Heading>
          <p className="leading-relaxed text-ink-soft">
            People who still use this link will count as &ldquo;Direct or
            unknown&rdquo;. The visits it already brought stay in Analytics,
            marked as deleted.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              autoFocus
              onClick={() => dialog.current?.close()}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await deleteSource(id);
                dialog.current?.close();
                setPending(false);
              }}
            >
              {pending ? "Deleting..." : "Delete link"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
