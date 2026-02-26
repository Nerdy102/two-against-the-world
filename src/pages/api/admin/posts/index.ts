import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { ensurePostsSchema, getDb, tableHasColumn, type PostRecord } from "../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";
import { deriveVideoPoster } from "../../../../lib/stream";

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

export const GET: APIRoute = async ({ locals, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json(
      { ok: false, error: "Unauthorized", detail: "Admin session required.", code: "ADMIN_UNAUTHORIZED" },
      401
    );
  }
  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    const { results } = await db
      .prepare(
        `SELECT * FROM posts
         ORDER BY pinned DESC, pinned_priority DESC, sort_order DESC, datetime(updated_at) DESC`
      )
      .all<PostRecord>();
    return json({ ok: true, posts: results ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load posts.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_POSTS_FETCH_FAILED" }, 500);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
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
  try {
    const payload = await request.json().catch(() => null);
    if (!payload) {
      return json(
        { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
        400
      );
    }

    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const rawSlug = typeof payload.slug === "string" ? payload.slug.trim() : "";
    const authorName = typeof payload.author_name === "string"
      ? payload.author_name.trim()
      : typeof payload.author === "string"
        ? payload.author.trim()
        : "";
    const topic = typeof payload.topic === "string" ? payload.topic.trim() : "";
    const bodyMarkdown = typeof payload.body_markdown === "string"
      ? payload.body_markdown.trim()
      : typeof payload.content_md === "string"
        ? payload.content_md.trim()
        : "";
    if (!title) {
      return json(
        { ok: false, error: "Missing title", detail: "Title is required.", code: "POST_TITLE_MISSING" },
        400
      );
    }
    if (!topic) {
      return json(
        { ok: false, error: "Missing topic", detail: "Topic is required.", code: "POST_TOPIC_MISSING" },
        400
      );
    }
    if (!authorName) {
      return json(
        { ok: false, error: "Missing author", detail: "Author is required.", code: "POST_AUTHOR_MISSING" },
        400
      );
    }
    if (!bodyMarkdown) {
      return json(
        { ok: false, error: "Missing body", detail: "Content is required.", code: "POST_BODY_MISSING" },
        400
      );
    }

    const id = crypto.randomUUID();
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    const hasLegacyAuthor = await tableHasColumn(db, "posts", "author");
    const baseSlug = slugify(rawSlug || title);
    if (!baseSlug) {
      return json(
        { ok: false, error: "Missing slug", detail: "Slug is required.", code: "POST_SLUG_MISSING" },
        400
      );
    }
    const slug = await ensureUniqueSlug(db, baseSlug);

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
        firstMarkdownImage(bodyMarkdown) ??
        firstMarkdownImage(typeof payload.content_md === "string" ? payload.content_md : null);

    const legacyAuthorColumn = hasLegacyAuthor ? ", author" : "";
    const legacyAuthorValue = hasLegacyAuthor ? ", ?" : "";
    const legacyAuthorBind = hasLegacyAuthor ? [authorName] : [];
    await db
      .prepare(
        `INSERT INTO posts (
          id, slug, title, summary, body_markdown, tags_json, cover_key, cover_url, content_md,
          status, author_name, topic, location, event_time, written_at, photo_time, tags_csv,
          side_note, voice_memo, voice_memo_title, video_url, video_poster, photo_dir, photo_count, pinned, pinned_priority,
          pinned_until, pinned_style, layout, sort_order, published_at${legacyAuthorColumn}
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?${legacyAuthorValue}
        )`
      )
      .bind(
        id,
        slug,
        title,
        payload.summary ?? null,
        bodyMarkdown,
        tagsJson,
        resolvedCoverKey,
        resolvedCoverUrl,
        payload.content_md ?? null,
        status,
        authorName,
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
        publishedAt,
        ...legacyAuthorBind
      )
      .run();

    return json({ ok: true, id, slug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create post.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_POST_CREATE_FAILED" }, 500);
  }
};
