// Lives outside actions.ts: a "use server" file can only export async
// functions, so the form could not read this list from there.
export const REPORT_REASONS = [
  { id: "spam", label: "Spam or misleading links" },
  { id: "scam", label: "Scam, phishing or malware" },
  { id: "impersonation", label: "Pretending to be someone else" },
  { id: "adult", label: "Adult or violent content" },
  { id: "other", label: "Something else" },
] as const;
