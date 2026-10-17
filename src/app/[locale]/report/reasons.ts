// Lives outside actions.ts: a "use server" file can only export async
// functions, so the form could not read this list from there. Each id's
// name is the "report.reasons" message with the same key.
export const REPORT_REASONS = [
  { id: "spam" },
  { id: "scam" },
  { id: "impersonation" },
  { id: "adult" },
  { id: "other" },
] as const;
