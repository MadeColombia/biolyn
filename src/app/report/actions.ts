"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { visitorId } from "@/lib/rate-limit";
import { REPORT_REASONS } from "./reasons";

export type ReportState = { error?: string; sent?: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitReport(
  username: string,
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "")
    .trim()
    .slice(0, 500);
  const contact = String(formData.get("contact") ?? "")
    .trim()
    .slice(0, 200);
  if (!REPORT_REASONS.some((r) => r.id === reason)) {
    return { error: "Pick a reason." };
  }
  if (contact && !EMAIL.test(contact)) {
    return { error: "That email doesn't look right. You can leave it empty." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "Reports aren't available right now." };

  const { data, error } = await admin.rpc("submit_report", {
    p_username: username,
    p_reason: reason,
    p_details: details,
    p_contact: contact,
    p_visitor: visitorId(await headers()),
  });
  if (error) return { error: "Could not send the report. Try again." };
  if (data === "rate_limited") {
    return { error: "You've sent several reports already. Try again later." };
  }
  if (data === "not_found") return { error: "That page doesn't exist." };
  return { sent: true };
}
