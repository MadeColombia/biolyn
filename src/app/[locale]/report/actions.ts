"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { visitorId } from "@/lib/rate-limit";
import { actionTranslator } from "@/i18n/server";
import { REPORT_REASONS } from "./reasons";

export type ReportState = { error?: string; sent?: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitReport(
  username: string,
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const t = await actionTranslator();
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "")
    .trim()
    .slice(0, 500);
  const contact = String(formData.get("contact") ?? "")
    .trim()
    .slice(0, 200);
  if (!REPORT_REASONS.some((r) => r.id === reason)) {
    return { error: t("errors.reportReason") };
  }
  if (contact && !EMAIL.test(contact)) {
    return { error: t("errors.reportEmail") };
  }

  const admin = createAdminClient();
  if (!admin) return { error: t("errors.reportsOff") };

  const { data, error } = await admin.rpc("submit_report", {
    p_username: username,
    p_reason: reason,
    p_details: details,
    p_contact: contact,
    p_visitor: visitorId(await headers()),
  });
  if (error) return { error: t("errors.reportFailed") };
  if (data === "rate_limited") {
    return { error: t("errors.reportTooMany") };
  }
  if (data === "not_found") return { error: t("errors.reportNoPage") };
  return { sent: true };
}
