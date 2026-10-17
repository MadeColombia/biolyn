"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, cx } from "@/components/ui";
import {
  MAX_SECTION_TITLE,
  SECTION_LAYOUTS,
  type SectionLayout,
} from "@/lib/sections";
import type { FormState } from "./actions";

/**
 * The add and edit section form: an optional title and a style (a list
 * of buttons or a row of cards). `section` fills it in for editing.
 */
export function SectionForm({
  section,
  action,
  submitLabel,
  pendingLabel,
  onSaved,
  onCancel,
}: {
  section?: { id: string; title: string | null; layout: SectionLayout };
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("sectionForm");
  const common = useTranslations("common");
  const idPrefix = section ? `section-${section.id}` : "section-new";
  const [layout, setLayout] = useState<SectionLayout>(
    section?.layout ?? "carousel",
  );
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
        maxLength={MAX_SECTION_TITLE}
        defaultValue={section?.title ?? ""}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-bold text-ink">
          {t("style")}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {SECTION_LAYOUTS.map((option) => (
            <label
              key={option}
              className={cx(
                "flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
                layout === option
                  ? "border-brand bg-raised"
                  : "border-edge bg-surface hover:bg-raised",
              )}
            >
              <input
                type="radio"
                name="layout"
                value={option}
                checked={layout === option}
                onChange={() => setLayout(option)}
                className="sr-only"
              />
              <LayoutPicture layout={option} />
              <span className="text-sm font-bold text-ink">{t(option)}</span>
              <span className="text-xs text-ink-muted">
                {t(`${option}Hint`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
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

/**
 * A tiny picture of the style, like the button size choice. `small` is
 * the version for a row in the list.
 */
export function LayoutPicture({
  layout,
  small = false,
}: {
  layout: SectionLayout;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cx("flex items-center justify-center", small ? "h-9" : "h-16")}
    >
      {layout === "list" ? (
        <span className="flex w-full flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cx(
                "w-full rounded-md border border-edge bg-canvas",
                small ? "h-2" : "h-3.5",
              )}
            />
          ))}
        </span>
      ) : (
        <span
          className={cx(
            "flex h-full w-full overflow-hidden",
            small ? "gap-1 py-1" : "gap-1.5",
          )}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cx(
                "flex h-full w-2/5 shrink-0 flex-col gap-1 rounded-lg border border-edge bg-canvas p-1",
                i === 2 && "opacity-50",
              )}
            >
              <span className="flex-1 rounded bg-line" />
              {!small && <span className="h-1.5 w-2/3 rounded bg-ink-muted" />}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
