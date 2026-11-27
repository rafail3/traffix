import { existsSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";

// The newest APK, copied into public/apk by scripts/fetch-apk.mjs during the Vercel build.
const apk: { file: string } | null = existsSync("public/apk/latest.json")
  ? JSON.parse(readFileSync("public/apk/latest.json", "utf8"))
  : null;

const APK_HEADERS = [
  { key: "Content-Type", value: "application/vnd.android.package-archive" },
  { key: "Cache-Control", value: "public, max-age=300" },
];

// Server-only routes (the account API) are named route.api.ts: the Vercel build picks them up,
// the static export for the APK doesn't see them, so it stays a plain offline bundle.
const SERVER = { pageExtensions: ["tsx", "ts", "jsx", "js", "api.ts"] };

// The Android app ships the site as static files (out/). Vercel keeps the normal build, which
// also serves /download: the APK file itself, straight from our domain, named traffix-vX.Y.Z.apk.
const nextConfig: NextConfig = process.env.STATIC_EXPORT
  ? { output: "export" }
  : apk
    ? {
        ...SERVER,
        async rewrites() {
          return [{ source: "/download", destination: `/apk/${apk.file}` }];
        },
        async headers() {
          return [
            {
              source: "/download",
              headers: [...APK_HEADERS, { key: "Content-Disposition", value: `attachment; filename="${apk.file}"` }],
            },
            { source: "/apk/:file(.*\\.apk)", headers: [...APK_HEADERS, { key: "Content-Disposition", value: "attachment" }] },
          ];
        },
      }
    : {
        ...SERVER,
        // No local copy (local dev, or GitHub was unreachable at build time).
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
