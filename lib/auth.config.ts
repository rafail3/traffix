// Entry point for the Better Auth CLI (npx auth migrate --config lib/auth.config.ts).
import { getAuth } from "./auth";

export const auth = getAuth();
