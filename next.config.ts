import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type checking é feito localmente (npx tsc --noEmit) — skip no build do Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
