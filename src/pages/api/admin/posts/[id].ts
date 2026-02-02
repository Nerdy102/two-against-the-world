import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb } from "../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const PUT: APIRoute = async ({ locals, params, request }) => {
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

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const db = getDb(locals);
  await ensurePostsSchema(db);
  if (payload.slug) {
    const existing = await db
      .prepare(`SELECT id FROM posts WHERE slug = ? LIMIT 1`)
      .bind(payload.slug)
      .first<{ id: string }>();
    if (existing?.id && existing.id !== id) {
      return json({ error: "Slug already exists" }, 409);
    }
  }
  const tagsJson =
    payload.tags_json ??
    (payload.tags_csv
      ? JSON.stringify(
          String(payload.tags_csv)
            .split(",")
            .map((tag: string) => tag.trim())
            .filter(Boolean)
        )
      : null);
  const status = payload.status === "published" ? "published" : "draft";
  const publishedAt =
    status === "published"
      ? payload.published_at ?? new Date().toISOString()
      : payload.published_at ?? null;

  await db
    .prepare(
      `UPDATE posts
       SET title = ?,
           slug = ?,
           summary = ?,
           content_md = ?,
           body_markdown = ?,
           tags_json = ?,
           cover_key = ?,
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
           pinned_priority = ?,
           pinned_until = ?,
           pinned_style = ?,
           layout = ?,
           sort_order = ?,
           status = ?,
           published_at = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      payload.title ?? "",
      payload.slug ?? "",
      payload.summary ?? null,
      payload.content_md ?? null,
      payload.body_markdown ?? payload.content_md ?? null,
      tagsJson,
      payload.cover_key ?? null,
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
      Number(payload.pinned_priority ?? 0) || 0,
      payload.pinned_until ? payload.pinned_until : null,
      payload.pinned_style ?? null,
      payload.layout ?? "normal",
      payload.sort_order ?? 0,
      status,
      publishedAt,
      id
    )
    .run();

  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, params, request }) => {
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
  await db.prepare(`DELETE FROM posts WHERE id = ?`).bind(id).run();
  return json({ ok: true });
};
