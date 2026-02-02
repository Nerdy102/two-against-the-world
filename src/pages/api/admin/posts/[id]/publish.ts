import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb } from "../../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ locals, params, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!verifyCsrf(request)) {
    return json({ error: "Unauthorized" }, 401);
  }
  const id = params.id;
  if (!id) {
    return json({ error: "Missing id" }, 400);
  }

  const db = getDb(locals);
  await ensurePostsSchema(db);
  await db
    .prepare(
      `UPDATE posts
       SET status = 'published',
           published_at = COALESCE(published_at, datetime('now')),
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(id)
    .run();

  return json({ ok: true });
};
