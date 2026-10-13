"use client";

import { useActionState } from "react";
import { submitReport, type ReportState } from "../actions";
import { REPORT_REASONS } from "../reasons";

const input =
  "rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900";

export function ReportForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(
    submitReport.bind(null, username),
    {},
  );

  if (state.sent) {
    return <p>Thanks. The report was sent and we&apos;ll review this page.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">What&apos;s wrong?</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.id} className="flex items-center gap-2">
            <input type="radio" name="reason" value={r.id} required />
            {r.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Details (optional)</span>
        <textarea name="details" maxLength={500} rows={4} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Your email (optional)</span>
        <input
          name="contact"
          type="email"
          maxLength={200}
          placeholder="Only if you want us to follow up"
          className={input}
        />
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Sending..." : "Send report"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
