import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb, type PostRecord } from "../../../../lib/d1";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const GET: APIRoute = async ({ locals }) => {
  const db = getDb(locals);
  await ensurePostsSchema(db);
  const { results } = await db
    .prepare(`SELECT * FROM posts ORDER BY datetime(updated_at) DESC`)
    .all<PostRecord>();
  return json({ posts: results ?? [] });
};

export const POST: APIRoute = async ({ locals, request }) => {
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

  await db
    .prepare(
      `INSERT INTO posts (id, slug, title, summary, content_md, cover_url, status, author, topic, location, event_time, written_at, photo_time, tags_csv, side_note, voice_memo, voice_memo_title, photo_dir, photo_count, pinned)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      slug,
      title,
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
      Number(payload.pinned ?? 0) === 1 ? 1 : 0
    )
    .run();

  return json({ ok: true, id });
};
