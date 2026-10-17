import { beforeEach, describe, expect, it, vi } from "vitest";

const allow = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
vi.mock("@/lib/rate-limit", () => ({ allow }));

const { sendErrorAlert } = await import("@/lib/alerts");

const details = {
  message: "boom",
  path: "/ethan",
  method: "GET",
  routePath: "/[username]",
  routeType: "render",
};

describe("sendErrorAlert", () => {
  let fetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    allow.mockReset().mockResolvedValue(true);
    fetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("RESEND_API_KEY", "re_key");
    vi.stubEnv("ALERT_EMAIL", "me@biolyn.link");
  });

  it.each(["RESEND_API_KEY", "ALERT_EMAIL"])(
    "does nothing without %s",
    async (name) => {
      vi.stubEnv(name, "");
      await sendErrorAlert(details);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("emails the error through Resend", async () => {
    await sendErrorAlert({ ...details, digest: "123" });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer re_key",
    );
    const body = JSON.parse(String(init.body));
    expect(body.to).toBe("me@biolyn.link");
    expect(body.from).toBe("biolyn alerts <alerts@biolyn.link>");
    expect(body.subject).toBe("biolyn error on /[username]");
    expect(body.text).toContain("Request: GET /ethan");
    expect(body.text).toContain("Digest: 123");
    expect(body.html).toContain("<h1");
    expect(body.html).toContain("GET /ethan");
    expect(body.html).toContain("/biolyn/logs");
  });

  it("leaves out the digest line when there is none", async () => {
    await sendErrorAlert(details);
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.text).not.toContain("Digest:");
    expect(body.html).not.toContain("Digest");
  });

  it("mutes a repeat of the same error", async () => {
    allow.mockResolvedValueOnce(false);
    await sendErrorAlert(details);
    expect(fetch).not.toHaveBeenCalled();
    expect(allow.mock.calls[0][0]).toMatch(/^alert:[0-9a-f]{16}$/);
  });

  it("stops after the hourly cap", async () => {
    allow.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await sendErrorAlert(details);
    expect(fetch).not.toHaveBeenCalled();
    expect(allow).toHaveBeenLastCalledWith("alert:all", 20, 3600);
  });

  it("groups errors by digest when there is one", async () => {
    await sendErrorAlert({ ...details, digest: "d1" });
    await sendErrorAlert({ ...details, message: "other", digest: "d1" });
    expect(allow.mock.calls[0][0]).toBe(allow.mock.calls[2][0]);
  });

  it("never throws when Resend is down", async () => {
    fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(sendErrorAlert(details)).resolves.toBeUndefined();
  });
});
