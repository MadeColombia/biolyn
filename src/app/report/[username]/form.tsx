"use client";

import { useActionState } from "react";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  Heading,
  cx,
  input,
} from "@/components/ui";
import { submitReport, type ReportState } from "../actions";
import { REPORT_REASONS } from "../reasons";

// One selectable row per reason. The whole row is the click target and its
// border turns terracotta when its radio is picked.
const reasonRow =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3 transition hover:border-ink-muted has-[:checked]:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30";

export function ReportForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(
    submitReport.bind(null, username),
    {},
  );

  if (state.sent) {
    return (
      <Card className="flex flex-col gap-4" role="status">
        <Heading as="h2">Thanks.</Heading>
        <p className="leading-relaxed text-ink-soft">
          The report was sent and we&apos;ll review this page.
        </p>
        <ButtonLink href="/" variant="secondary" className="self-start">
          Go to Biolyn
        </ButtonLink>
      </Card>
    );
  }

  return (
    <Card padding="md" className="sm:p-8">
      <form action={action} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-3 text-sm font-bold text-ink">
            What&apos;s wrong?
          </legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className={reasonRow}>
              <input
                type="radio"
                name="reason"
                value={r.id}
                required
                className="size-4 shrink-0 accent-brand focus:outline-none"
              />
              <span className="leading-snug">{r.label}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="report-details"
            className="text-sm font-bold text-ink"
          >
            Details (optional)
          </label>
          <textarea
            id="report-details"
            name="details"
            maxLength={500}
            rows={4}
            className={cx(input(), "resize-y py-3 leading-relaxed")}
          />
        </div>
        <Field
          label="Your email (optional)"
          id="report-contact"
          name="contact"
          type="email"
          maxLength={200}
          placeholder="Only if you want us to follow up"
        />
        <Button type="submit" fullWidth disabled={pending}>
          {pending ? "Sending..." : "Send report"}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm leading-relaxed text-danger">
            {state.error}
          </p>
        )}
      </form>
    </Card>
  );
}
