import * as Sentry from "@sentry/nextjs";

// GLITCHTIP_DSN is unset in local dev/CI — Sentry.init() with an empty dsn
// is a documented no-op (SDK stays inert, no events sent), so this is safe
// to run unconditionally.
Sentry.init({
  dsn: process.env.GLITCHTIP_DSN,
  tracesSampleRate: 0,
});
