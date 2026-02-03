import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { ensurePostsSchema, getDb } from "../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const slugExists = async (db: D1Database, slug: string, excludeId?: string) => {
  const query = excludeId
    ? db.prepare(`SELECT id FROM posts WHERE slug = ? AND id != ? LIMIT 1`).bind(slug, excludeId)
    : db.prepare(`SELECT id FROM posts WHERE slug = ? LIMIT 1`).bind(slug);
  const existing = await query.first<{ id: string }>();
  return Boolean(existing?.id);
};

const ensureUniqueSlug = async (db: D1Database, baseSlug: string, excludeId?: string) => {
  let candidate = baseSlug;
  let suffix = 2;
  while (candidate && (await slugExists(db, candidate, excludeId))) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

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

  try {
    const payload = await request.json().catch(() => null);
    if (!payload) {
      return json({ error: "Invalid JSON" }, 400);
    }

    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    const current = await db
      .prepare(`SELECT slug FROM posts WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<{ slug: string }>();
    const incomingSlug = typeof payload.slug === "string" ? payload.slug.trim() : "";
    let nextSlug = current?.slug ?? "";
    if (incomingSlug) {
      const baseSlug = slugify(incomingSlug);
      if (!baseSlug) {
        return json({ error: "Missing slug" }, 400);
      }
      nextSlug = await ensureUniqueSlug(db, baseSlug, id);
    }
    if (!nextSlug) {
      const baseSlug = slugify(payload.title ?? "");
      if (!baseSlug) {
        return json({ error: "Missing slug" }, 400);
      }
      nextSlug = await ensureUniqueSlug(db, baseSlug, id);
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
        nextSlug,
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

    return json({ ok: true, slug: nextSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update post.";
    return json({ error: message }, 500);
  }
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
  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    await db.prepare(`DELETE FROM posts WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete post.";
    return json({ error: message }, 500);
  }
};
