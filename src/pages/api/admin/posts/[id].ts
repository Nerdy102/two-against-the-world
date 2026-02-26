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
import { deriveVideoPoster } from "../../../../lib/stream";
import { sanitizeSummaryText } from "../../../../lib/followUpLink";
import { buildOrderedPostMediaUrls, syncPostMediaOrder } from "../../../../lib/postMedia";
import { DEFAULT_TOPIC_SLUG, parseTopicSlug } from "../../../../config/topics";

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

const normalizeDateTime = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const normalizeTimeZone = (value: unknown) => {
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
      .prepare(`SELECT slug, topic, published_at, published_tz FROM posts WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<{ slug: string; topic: string | null; published_at: string | null; published_tz: string | null }>();
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
    const incomingTopicInput = typeof payload.topic === "string" ? payload.topic.trim() : "";
    const parsedIncomingTopic = incomingTopicInput ? parseTopicSlug(incomingTopicInput) : null;
    if (incomingTopicInput && !parsedIncomingTopic) {
      return json(
        { ok: false, error: "Invalid topic", detail: "Topic is not recognized.", code: "POST_TOPIC_INVALID" },
        400
      );
    }
    const topic = parsedIncomingTopic ?? parseTopicSlug(current?.topic ?? null) ?? DEFAULT_TOPIC_SLUG;
    const bodyMarkdown = typeof payload.body_markdown === "string"
      ? payload.body_markdown.trim()
      : typeof payload.content_md === "string"
        ? payload.content_md.trim()
        : null;
    const summary = sanitizeSummaryText(typeof payload.summary === "string" ? payload.summary : "");
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
    const normalizedPublishedAt = normalizeDateTime(payload.published_at);
    const publishedAt =
      status === "published"
        ? normalizedPublishedAt ?? current?.published_at ?? new Date().toISOString()
        : normalizedPublishedAt ?? current?.published_at ?? null;
    const publishedTz = normalizeTimeZone(payload.published_tz) ?? current?.published_tz ?? null;
    const resolvedBodyMarkdown =
      bodyMarkdown ?? (typeof payload.body_markdown === "string" ? payload.body_markdown.trim() : null);
    const videoUrl = typeof payload.video_url === "string" ? payload.video_url.trim() : "";
    const manualVideoPoster = typeof payload.video_poster === "string"
      ? payload.video_poster.trim()
      : "";
    const derivedVideoPoster = deriveVideoPoster(videoUrl, {
      deliveryBase: String(locals.runtime?.env?.PUBLIC_CF_STREAM_DELIVERY_BASE ?? ""),
    });
    const resolvedVideoPoster = manualVideoPoster || derivedVideoPoster || null;
    const resolvedCoverKey = videoUrl ? null : payload.cover_key ?? null;
    const resolvedCoverUrl = videoUrl
      ? null
      : normalizeCoverUrl(payload.cover_url) ??
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
             published_tz = ?,
             updated_at = datetime('now')${legacyAuthorSet}
         WHERE id = ?`
      )
      .bind(
        payload.title ?? "",
        nextSlug,
        summary || null,
        resolvedBodyMarkdown ?? payload.content_md ?? null,
        tagsJson,
        resolvedCoverKey,
        resolvedCoverUrl,
        payload.content_md ?? null,
        authorName ?? null,
        topic,
        payload.location ?? null,
        payload.event_time ?? null,
        payload.written_at ?? null,
        payload.photo_time ?? null,
        payload.tags_csv ?? null,
        payload.side_note ?? null,
        payload.voice_memo ?? null,
        payload.voice_memo_title ?? null,
        videoUrl || null,
        resolvedVideoPoster,
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
        publishedTz,
        ...legacyAuthorBind,
        id
      )
      .run();

    const orderedUrls = buildOrderedPostMediaUrls({
      coverUrl: resolvedCoverUrl,
      bodyMarkdown: resolvedBodyMarkdown,
      contentMarkdown: typeof payload.content_md === "string" ? payload.content_md : null,
    });
    await syncPostMediaOrder({
      db,
      postId: id,
      orderedUrls,
    });

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
