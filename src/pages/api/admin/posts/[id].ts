import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb } from "../../../../lib/d1";
import { isAdminAuthorized } from "../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const PUT: APIRoute = async ({ locals, params, request }) => {
  if (!(await isAdminAuthorized(request, locals))) {
    return json({ error: "Unauthorized" }, 401);
  }
  const id = params.id;
  if (!id) {
    return json({ error: "Missing id" }, 400);
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const db = getDb(locals);
  await ensurePostsSchema(db);
  await db
    .prepare(
      `UPDATE posts
       SET title = ?,
           slug = ?,
           summary = ?,
           content_md = ?,
           cover_url = ?,
           author = ?,
           topic = ?,
           location = ?,
           event_time = ?,
           written_at = ?,
           photo_time = ?,
           tags_csv = ?,
           side_note = ?,
           voice_memo = ?,
           voice_memo_title = ?,
           photo_dir = ?,
           photo_count = ?,
           pinned = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      payload.title ?? "",
      payload.slug ?? "",
      payload.summary ?? null,
      payload.content_md ?? null,
      payload.cover_url ?? null,
      payload.author ?? null,
      payload.topic ?? null,
      payload.location ?? null,
      payload.event_time ?? null,
      payload.written_at ?? null,
      payload.photo_time ?? null,
      payload.tags_csv ?? null,
      payload.side_note ?? null,
      payload.voice_memo ?? null,
      payload.voice_memo_title ?? null,
      payload.photo_dir ?? null,
      payload.photo_count ?? 0,
      Number(payload.pinned ?? 0) === 1 ? 1 : 0,
      id
    )
    .run();

  return json({ ok: true });
};
