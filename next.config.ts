import type { NextConfig } from "next";

// The Android app ships the site as static files (out/). Vercel keeps the normal build,
// which also serves /download: a short link (used by the QR code) to the newest APK.
const nextConfig: NextConfig = process.env.STATIC_EXPORT
  ? { output: "export" }
  : {
      async redirects() {
        return [
          {
            source: "/download",
            destination: "https://github.com/rafail3/traffix/releases/latest/download/traffix.apk",
            permanent: false,
          },
        ];
      },
    };

export default nextConfig;
