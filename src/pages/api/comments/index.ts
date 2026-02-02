import type { APIRoute } from "astro";
import { getDb, type CommentRecord } from "../../../lib/d1";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const GET: APIRoute = async ({ locals, url }) => {
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }
  const db = getDb(locals);
  const { results } = await db
    .prepare(
      `SELECT id, post_slug, parent_id, display_name, body, status, created_at
       FROM comments
       WHERE post_slug = ? AND status = 'visible'
       ORDER BY datetime(created_at) DESC
       LIMIT 200`
    )
    .bind(slug)
    .all<CommentRecord>();
  return json({ comments: results ?? [] });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const displayName =
    typeof payload.displayName === "string"
      ? payload.displayName.trim()
      : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const parentId =
    typeof payload.parentId === "string" ? payload.parentId.trim() : null;

  if (!slug || !displayName || !body) {
    return json({ error: "Missing fields" }, 400);
  }

  const db = getDb(locals);
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO comments (id, post_slug, parent_id, display_name, body, status)
       VALUES (?, ?, ?, ?, ?, 'visible')`
    )
    .bind(id, slug, parentId, displayName, body)
    .run();

  return json({ ok: true, id });
};
