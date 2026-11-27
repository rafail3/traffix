import { APP_ORIGINS } from "./auth";

// The website calls the API from its own origin; only the Android app needs CORS.
function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !APP_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Expose-Headers": "set-auth-token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export const preflight = (req: Request) => new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });

export function withCors(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders(req.headers.get("origin")))) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });
