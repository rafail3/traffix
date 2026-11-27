import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { bearer } from "better-auth/plugins/bearer";
import { username } from "better-auth/plugins/username";
import { Pool } from "pg";
import { MIN_PASSWORD } from "./account";

/** The Android app (Capacitor WebView) talks to this site from these origins. */
export const APP_ORIGINS = ["https://localhost", "capacitor://localhost"];

/** Tables Traffix adds next to Better Auth's own: one row of cloud data per account. */
const traffixData = () =>
  ({
    id: "traffix-data",
    schema: {
      profileData: {
        fields: {
          userId: { type: "string", required: true, unique: true, references: { model: "user", field: "id", onDelete: "cascade" } },
          data: { type: "string", required: true },
          updatedAt: { type: "date", required: true },
        },
      },
    },
  }) satisfies BetterAuthPlugin;

const createAuth = () => betterAuth({
  appName: "Traffix",
  database: new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }),
  // Username + password only. The account's email is a placeholder (lib/account.ts), never used.
  emailAndPassword: { enabled: true, minPasswordLength: MIN_PASSWORD, autoSignIn: true },
  user: {
    additionalFields: {
      // scrypt hash of the recovery code; the plain code is shown to the user once and never stored.
      recoveryHash: { type: "string", required: false, input: false, returned: false },
    },
  },
  trustedOrigins: APP_ORIGINS,
  // Shared across function instances, unlike the in-memory default.
  rateLimit: { enabled: true, storage: "database" },
  // bearer(): the app and the site send "Authorization: Bearer <token>" instead of relying on cookies,
  // which a WebView on https://localhost wouldn't send to this domain.
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 20 }), bearer(), traffixData()],
});

// Created on first use, not at import, so `next build` never touches the database or the secret.
let instance: ReturnType<typeof createAuth> | undefined;
export const getAuth = () => (instance ??= createAuth());

/** The signed-in user for an API request, or null. */
export async function currentUser(req: Request) {
  const s = await getAuth().api.getSession({ headers: req.headers });
  return s?.user ?? null;
}
