import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import {
  ensureCommentsSchema,
  ensurePostMediaSchema,
  ensurePostsSchema,
  ensureReactionsSchema,
  getDb,
  tableHasColumn,
} from "../../../../lib/d1";
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

const FIRST_MARKDOWN_IMAGE_RE = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/;

const firstMarkdownImage = (markdown: string | null | undefined) => {
  if (!markdown) return null;
  const match = markdown.match(FIRST_MARKDOWN_IMAGE_RE);
  const value = match?.[1]?.trim().replace(/^<|>$/g, "");
  return value || null;
};

const normalizeCoverUrl = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

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
    return json(
      { ok: false, error: "Unauthorized", detail: "Admin session required.", code: "ADMIN_UNAUTHORIZED" },
      401
    );
  }
  if (!verifyCsrf(request)) {
    return json(
      { ok: false, error: "Unauthorized", detail: "CSRF validation failed.", code: "ADMIN_CSRF_INVALID" },
      401
    );
  }
  const id = params.id;
  if (!id) {
    return json(
      { ok: false, error: "Missing id", detail: "Post id is required.", code: "POST_ID_MISSING" },
      400
    );
  }

  try {
    const payload = await request.json().catch(() => null);
    if (!payload) {
      return json(
        { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
        400
      );
    }

    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    await ensureCommentsSchema(db, { allowBootstrap });
    await ensureReactionsSchema(db, { allowBootstrap });
    await ensurePostMediaSchema(db, { allowBootstrap });
    const hasLegacyAuthor = await tableHasColumn(db, "posts", "author");
    const current = await db
      .prepare(`SELECT slug FROM posts WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<{ slug: string }>();
    const incomingSlug = typeof payload.slug === "string" ? payload.slug.trim() : "";
    let nextSlug = current?.slug ?? "";
    if (incomingSlug) {
      const baseSlug = slugify(incomingSlug);
      if (!baseSlug) {
        return json(
          { ok: false, error: "Missing slug", detail: "Slug is required.", code: "POST_SLUG_MISSING" },
          400
        );
      }
      nextSlug = await ensureUniqueSlug(db, baseSlug, id);
    }
    if (!nextSlug) {
      const baseSlug = slugify(payload.title ?? "");
      if (!baseSlug) {
        return json(
          { ok: false, error: "Missing slug", detail: "Slug is required.", code: "POST_SLUG_MISSING" },
          400
        );
      }
      nextSlug = await ensureUniqueSlug(db, baseSlug, id);
    }
    const authorName = typeof payload.author_name === "string"
      ? payload.author_name.trim()
      : typeof payload.author === "string"
        ? payload.author.trim()
        : null;
    const topic = typeof payload.topic === "string" ? payload.topic.trim() : null;
    const bodyMarkdown = typeof payload.body_markdown === "string"
      ? payload.body_markdown.trim()
      : typeof payload.content_md === "string"
        ? payload.content_md.trim()
        : null;
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
    const status =
      payload.status === "published" || payload.status === "archived"
        ? payload.status
        : "draft";
    const publishedAt =
      status === "published"
        ? payload.published_at ?? new Date().toISOString()
        : payload.published_at ?? null;
    const resolvedBodyMarkdown =
      bodyMarkdown ?? (typeof payload.body_markdown === "string" ? payload.body_markdown.trim() : null);
    const resolvedCoverUrl =
      normalizeCoverUrl(payload.cover_url) ??
      firstMarkdownImage(resolvedBodyMarkdown) ??
      firstMarkdownImage(typeof payload.content_md === "string" ? payload.content_md : null);

    const legacyAuthorSet = hasLegacyAuthor ? ", author = ?" : "";
    const legacyAuthorBind = hasLegacyAuthor ? [authorName ?? ""] : [];
    await db
      .prepare(
        `UPDATE posts
         SET title = ?,
             slug = ?,
             summary = ?,
             body_markdown = ?,
             tags_json = ?,
             cover_key = ?,
             cover_url = ?,
             content_md = ?,
             author_name = ?,
             topic = ?,
             location = ?,
             event_time = ?,
             written_at = ?,
             photo_time = ?,
             tags_csv = ?,
             side_note = ?,
             voice_memo = ?,
             voice_memo_title = ?,
             video_url = ?,
             video_poster = ?,
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
             updated_at = datetime('now')${legacyAuthorSet}
         WHERE id = ?`
      )
      .bind(
        payload.title ?? "",
        nextSlug,
        payload.summary ?? null,
        resolvedBodyMarkdown ?? payload.content_md ?? null,
        tagsJson,
        payload.cover_key ?? null,
        resolvedCoverUrl,
        payload.content_md ?? null,
        authorName ?? null,
        topic ?? null,
        payload.location ?? null,
        payload.event_time ?? null,
        payload.written_at ?? null,
        payload.photo_time ?? null,
        payload.tags_csv ?? null,
        payload.side_note ?? null,
        payload.voice_memo ?? null,
        payload.voice_memo_title ?? null,
        payload.video_url ?? null,
        payload.video_poster ?? null,
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
        ...legacyAuthorBind,
        id
      )
      .run();

    return json({ ok: true, slug: nextSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update post.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_POST_UPDATE_FAILED" }, 500);
  }
};

export const DELETE: APIRoute = async ({ locals, params, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json(
      { ok: false, error: "Unauthorized", detail: "Admin session required.", code: "ADMIN_UNAUTHORIZED" },
      401
    );
  }
  if (!verifyCsrf(request)) {
    return json(
      { ok: false, error: "Unauthorized", detail: "CSRF validation failed.", code: "ADMIN_CSRF_INVALID" },
      401
    );
  }
  const id = params.id;
  if (!id) {
    return json(
      { ok: false, error: "Missing id", detail: "Post id is required.", code: "POST_ID_MISSING" },
      400
    );
  }
  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    await ensureCommentsSchema(db, { allowBootstrap });
    await ensureReactionsSchema(db, { allowBootstrap });
    await ensurePostMediaSchema(db, { allowBootstrap });
    const post = await db
      .prepare(`SELECT slug FROM posts WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<{ slug: string }>();
    if (post?.slug) {
      await db.prepare(`DELETE FROM comments WHERE post_slug = ?`).bind(post.slug).run();
      await db.prepare(`DELETE FROM reactions WHERE post_slug = ?`).bind(post.slug).run();
    }
    await db.prepare(`DELETE FROM post_media WHERE post_id = ?`).bind(id).run();
    await db.prepare(`DELETE FROM posts WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete post.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_POST_DELETE_FAILED" }, 500);
  }
};
