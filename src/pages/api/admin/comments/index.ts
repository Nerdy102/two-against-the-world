import type { APIRoute } from "astro";
import { ensureCommentsSchema, getDb } from "../../../../lib/d1";
import { requireAdminSession } from "../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const GET: APIRoute = async ({ locals, request, url }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized" }, 401);
  }
  const status = url.searchParams.get("status");
  const slug = url.searchParams.get("slug");
  const db = getDb(locals);
  await ensureCommentsSchema(db);
  const params: unknown[] = [];
  let where = "1=1";
  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (slug) {
    where += " AND post_slug = ?";
    params.push(slug);
  }
  const { results } = await db
    .prepare(
      `SELECT id, post_slug, parent_id, display_name, body, status, created_at
       FROM comments
       WHERE ${where}
       ORDER BY datetime(created_at) DESC
       LIMIT 300`
    )
    .bind(...params)
    .all();
  return json({ comments: results ?? [] });
};
