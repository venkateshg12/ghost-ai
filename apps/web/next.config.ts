import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second build output directory for tests (NEXT_DIST_DIR=.next-e2e), so a test build can never overwrite the
  // folder a running `pnpm dev` is using.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    // Google profile photos (Google sign-in avatars).
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
