// Better Auth: sign up, sign in, sign out, session. Files named route.api.ts only exist in the
// Vercel build; the static export for the APK leaves them out (see pageExtensions in next.config.ts).
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";

export const GET = withCors((req) => toNextJsHandler(getAuth()).GET(req));
export const POST = withCors((req) => toNextJsHandler(getAuth()).POST(req));
export const OPTIONS = preflight;
