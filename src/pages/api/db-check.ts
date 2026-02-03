import type { APIRoute } from "astro";
import { getDb } from "../../lib/d1";
import { getRuntimeEnv } from "../../lib/runtimeEnv";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const env = getRuntimeEnv(locals);
  if (!env.DB) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing DB binding",
        detail: "DB binding is required.",
        howToFix:
          "Add D1 binding named DB in wrangler.jsonc and Cloudflare dashboard for two-against-the-world1, then redeploy.",
        code: "DB_BINDING_MISSING",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
  const db = getDb(locals);
  const result = await db.prepare("SELECT 1 as ok").first<{ ok: number }>();
  return new Response(JSON.stringify({ ok: Boolean(result?.ok) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
