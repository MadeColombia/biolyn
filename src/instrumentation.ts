import type { Instrumentation } from "next";

// Next.js calls this for every server error (pages, route handlers,
// server actions, proxy). We forward it as an email alert.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { sendErrorAlert } = await import("@/lib/alerts");
  await sendErrorAlert({
    message: err instanceof Error ? err.message : String(err),
    digest:
      typeof err === "object" && err !== null && "digest" in err
        ? String(err.digest)
        : undefined,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
