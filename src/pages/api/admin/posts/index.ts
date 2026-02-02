import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb, type PostRecord } from "../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const GET: APIRoute = async ({ locals, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(locals);
  await ensurePostsSchema(db);
  const { results } = await db
    .prepare(
      `SELECT * FROM posts
       ORDER BY pinned DESC, pinned_priority DESC, sort_order DESC, datetime(updated_at) DESC`
    )
    .all<PostRecord>();
  return json({ posts: results ?? [] });
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!verifyCsrf(request)) {
    return json({ error: "Unauthorized" }, 401);
  }
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  if (!title || !slug) {
    return json({ error: "Missing title/slug" }, 400);
  }

  const id = crypto.randomUUID();
  const db = getDb(locals);
  await ensurePostsSchema(db);
  const existingSlug = await db
    .prepare(`SELECT id FROM posts WHERE slug = ? LIMIT 1`)
    .bind(slug)
    .first<{ id: string }>();
  if (existingSlug?.id) {
    return json({ error: "Slug already exists" }, 409);
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
      `INSERT INTO posts (
        id, slug, title, summary, content_md, body_markdown, tags_json, cover_key, cover_url,
        status, author, topic, location, event_time, written_at, photo_time, tags_csv,
        side_note, voice_memo, voice_memo_title, photo_dir, photo_count, pinned, pinned_priority,
        pinned_until, pinned_style, layout, sort_order, published_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?
      )`
    )
    .bind(
      id,
      slug,
      title,
      payload.summary ?? null,
      payload.content_md ?? null,
      payload.body_markdown ?? payload.content_md ?? null,
      tagsJson,
      payload.cover_key ?? null,
      payload.cover_url ?? null,
      status,
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
      publishedAt
    )
    .run();

  return json({ ok: true, id });
};
