import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Deployable as a self-contained `.next/standalone` server image — see
  // Dockerfile.
  output: "standalone",
};

export default withSentryConfig(nextConfig, {
  // Source map upload targets Sentry's own release API (org/project/
  // authToken), which GlitchTip doesn't implement — only runtime error
  // reporting via the DSN is wired up (see src/instrumentation.ts). No
  // Sentry SaaS account is used or required.
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: true,
  },
});
