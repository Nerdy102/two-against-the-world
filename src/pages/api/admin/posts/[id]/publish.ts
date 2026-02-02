import type { APIRoute } from "astro";
import { getDb } from "../../../../../lib/d1";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ locals, params }) => {
  const id = params.id;
  if (!id) {
    return json({ error: "Missing id" }, 400);
  }

  const db = getDb(locals);
  await db
    .prepare(
      `UPDATE posts
       SET status = 'published',
           published_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(id)
    .run();

  return json({ ok: true });
};
