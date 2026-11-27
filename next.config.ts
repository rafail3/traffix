import type { NextConfig } from "next";

// The Android app ships the site as static files (out/). Vercel keeps the normal build.
const nextConfig: NextConfig = process.env.STATIC_EXPORT ? { output: "export" } : {};

export default nextConfig;
