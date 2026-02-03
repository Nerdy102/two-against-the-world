import type { APIRoute } from "astro";
import { ensureMediaSchema, ensurePostMediaSchema, ensurePostsSchema, getDb } from "../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const sanitizeSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const sanitizeFilename = (filename: string) => filename.replace(/[^\w.-]/g, "_");

const buildKey = (slug: string, filename: string) => {
  const safeSlug = sanitizeSlug(slug || "untitled") || "untitled";
  const date = new Date().toISOString().slice(0, 10);
  return `web/${date}/${safeSlug}/${sanitizeFilename(filename)}`;
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!verifyCsrf(request)) {
    return json({ error: "Unauthorized" }, 401);
  }
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "Invalid form data" }, 400);

  try {
    const file = form.get("file");
    const slug = typeof form.get("slug") === "string" ? String(form.get("slug")) : "untitled";
    const meta = typeof form.get("meta") === "string" ? String(form.get("meta")) : null;

    if (!(file instanceof File)) {
      return json({ error: "Missing file" }, 400);
    }
    if (!file.type.startsWith("image/")) {
      return json({ error: "Only images are supported" }, 400);
    }

    const filename = file.name || `upload-${Date.now()}.jpg`;
    const key = buildKey(slug, filename);
    const contentType = file.type || "image/jpeg";
    const bucket = locals.runtime?.env?.MEDIA;
    if (!bucket) {
      return json({ error: "Missing MEDIA binding" }, 500);
    }

    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType },
    });

    const baseUrl = locals.runtime?.env?.PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
    const url = baseUrl ? `${baseUrl}/${key}` : key;

    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    await ensureMediaSchema(db, { allowBootstrap });
    await ensurePostMediaSchema(db, { allowBootstrap });
    const post = await db
      .prepare(`SELECT id FROM posts WHERE slug = ? LIMIT 1`)
      .bind(slug)
      .first<{ id: string }>();
    await db
      .prepare(
        `INSERT INTO media (id, url, type, meta_json, uploaded_by)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), url, "image", meta, "admin")
      .run();
    if (post?.id) {
      let parsedMeta: { width?: number; height?: number; sort_order?: number } | null = null;
      try {
        parsedMeta = meta ? JSON.parse(meta) : null;
      } catch {
        parsedMeta = null;
      }
      await db
        .prepare(
          `INSERT INTO post_media (id, post_id, r2_key, url, width, height, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          post.id,
          key,
          url,
          parsedMeta?.width ?? null,
          parsedMeta?.height ?? null,
          parsedMeta?.sort_order ?? 0
        )
        .run();
    }

    return json({ ok: true, url, key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return json({ error: message }, 500);
  }
};
