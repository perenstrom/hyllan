import * as Sentry from "@sentry/nextjs";

// GLITCHTIP_DSN is unset in local dev/CI — Sentry.init() with an empty dsn
// is a documented no-op (SDK stays inert, no events sent), so this is safe
// to run unconditionally.
Sentry.init({
  dsn: process.env.GLITCHTIP_DSN,
  // GlitchTip doesn't support session tracking/replay (self-hosted
  // deployment doc), so tracing/replay integrations are intentionally not
  // configured here — error reporting only.
  tracesSampleRate: 0,
});
