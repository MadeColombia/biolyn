"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui";
import { MAX_TEXT_TITLE, TEXT_MAX_CHARS } from "@/lib/blocks";
import type { FormState } from "./actions";
import { BioEditor } from "./bio-editor";

/**
 * The add and edit text form: an optional title and a paragraph with the
 * same formatting buttons as the bio. `text` fills it in for editing.
 */
export function TextForm({
  text,
  action,
  submitLabel,
  pendingLabel,
  onSaved,
  onCancel,
}: {
  text?: { id: string; title: string | null; body: string };
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("textForm");
  const common = useTranslations("common");
  const idPrefix = text ? `text-${text.id}` : "text-new";
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (!result.error) onSaved?.();
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        id={`${idPrefix}-title`}
        label={t("title")}
        name="title"
        placeholder={t("titlePlaceholder")}
        hint={t("titleHint")}
        maxLength={MAX_TEXT_TITLE}
        defaultValue={text?.title ?? ""}
      />
      <BioEditor
        defaultValue={text?.body ?? null}
        name="body"
        id={`${idPrefix}-body`}
        max={TEXT_MAX_CHARS}
        label={t("body")}
        placeholder={t("bodyPlaceholder")}
        toolbarLabel={t("toolbar")}
        addLabel={t("addToText")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {common("cancel")}
          </Button>
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
