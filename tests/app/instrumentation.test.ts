import { beforeEach, describe, expect, it, vi } from "vitest";

const sendErrorAlert = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
vi.mock("@/lib/alerts", () => ({ sendErrorAlert }));

const { onRequestError } = await import("@/instrumentation");

const request = { path: "/ethan", method: "GET", headers: {} };
const context = {
  routerKind: "App Router",
  routePath: "/[username]",
  routeType: "render",
} as const;

describe("onRequestError", () => {
  beforeEach(() => {
    sendErrorAlert.mockClear();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
  });

  it("does nothing outside the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await onRequestError(new Error("x"), request, context as never);
    expect(sendErrorAlert).not.toHaveBeenCalled();
  });

  it("forwards an Error with its digest", async () => {
    const err = Object.assign(new Error("boom"), { digest: "123" });
    await onRequestError(err, request, context as never);
    expect(sendErrorAlert).toHaveBeenCalledWith({
      message: "boom",
      digest: "123",
      path: "/ethan",
      method: "GET",
      routePath: "/[username]",
      routeType: "render",
    });
  });

  it("forwards a thrown non-Error value", async () => {
    await onRequestError("plain text", request, context as never);
    expect(sendErrorAlert).toHaveBeenCalledWith(
      expect.objectContaining({ message: "plain text", digest: undefined }),
    );
  });
});
