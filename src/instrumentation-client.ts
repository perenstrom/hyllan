import * as Sentry from "@sentry/nextjs";

// NEXT_PUBLIC_GLITCHTIP_DSN is unset in local dev/CI — Sentry.init() with an
// empty dsn is a documented no-op (SDK stays inert, no events sent), so this
// is safe to run unconditionally. Must be NEXT_PUBLIC_-prefixed since this
// file runs in the browser.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_GLITCHTIP_DSN,
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
