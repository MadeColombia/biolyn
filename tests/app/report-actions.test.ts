import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type FakeClient } from "../helpers/supabase";

let admin: FakeClient | null;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/rate-limit", () => ({ visitorId: () => "visitor" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { submitReport } = await import("@/app/report/actions");
const { REPORT_REASONS } = await import("@/app/report/reasons");

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const send = (fields: Record<string, string>) =>
  submitReport("ethan", {}, form(fields));

describe("submitReport", () => {
  beforeEach(() => {
    admin = fakeClient();
    admin.rpc.mockResolvedValue({ data: "ok", error: null } as never);
  });

  it("has unique reason ids", () => {
    const ids = REPORT_REASONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each<Record<string, string>>([{}, { reason: "" }, { reason: "made-up" }])(
    "requires a known reason (%j)",
    async (fields) => {
      expect(await send(fields)).toEqual({ error: "Pick a reason." });
      expect(admin!.rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects a bad contact email", async () => {
    expect(await send({ reason: "spam", contact: "nope" })).toEqual({
      error: "That email doesn't look right. You can leave it empty.",
    });
  });

  it("sends a report with trimmed, length-capped text", async () => {
    const result = await send({
      reason: "scam",
      details: `  ${"x".repeat(600)}  `,
      contact: " me@biolyn.link ",
    });
    expect(result).toEqual({ sent: true });
    expect(admin!.rpc).toHaveBeenCalledWith("submit_report", {
      p_username: "ethan",
      p_reason: "scam",
      p_details: "x".repeat(500),
      p_contact: "me@biolyn.link",
      p_visitor: "visitor",
    });
  });

  it("works without a service key configured", async () => {
    admin = null;
    expect(await send({ reason: "spam" })).toEqual({
      error: "Reports aren't available right now.",
    });
  });

  it.each([
    [{ data: null, error: { message: "x" } }, "Could not send the report. Try again."],
    [{ data: "rate_limited", error: null }, "You've sent several reports already. Try again later."],
    [{ data: "not_found", error: null }, "That page doesn't exist."],
  ])("explains the database answer %j", async (answer, message) => {
    admin!.rpc.mockResolvedValueOnce(answer as never);
    expect(await send({ reason: "other" })).toEqual({ error: message });
  });
});
