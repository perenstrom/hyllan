import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    logger.info({ runtime: "nodejs" }, "instrumentation registered");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
