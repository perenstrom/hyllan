import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deployable as a self-contained `.next/standalone` server image — see
  // Dockerfile.
  output: "standalone",
  async rewrites() {
    // @supabase/ssr's clients always call `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/...`
    // (Kong's job in the full Supabase stack is normally to strip that
    // prefix before forwarding to GoTrue). This repo runs standalone GoTrue
    // with no Kong in front of it (compose.yaml), so this rewrite plays
    // Kong's role instead.
    return [
      {
        source: "/auth/v1/:path*",
        destination: `${process.env.GOTRUE_API_EXTERNAL_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
