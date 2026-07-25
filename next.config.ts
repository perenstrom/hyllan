import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deployable as a self-contained `.next/standalone` server image — see
  // Dockerfile.
  output: "standalone",
};

export default nextConfig;
