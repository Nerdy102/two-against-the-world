import type { APIRoute } from "astro";
import { getDb } from "../../lib/d1";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const db = getDb(locals);
  const result = await db.prepare("SELECT 1 as ok").first<{ ok: number }>();
  return new Response(JSON.stringify({ ok: Boolean(result?.ok) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
