import type { APIRoute } from "astro";
import { ensureMediaSchema, ensurePostMediaSchema, ensurePostsSchema, getDb } from "../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../lib/adminAuth";
import { getRuntimeEnv, isSchemaBootstrapEnabled } from "../../../lib/runtimeEnv";

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

const buildKey = (slug: string, batchId: number | string, index: number) => {
  const safeSlug = sanitizeSlug(slug || "untitled") || "untitled";
  const safeBatch = String(batchId || Date.now()).replace(/[^\w-]/g, "");
  const safeIndex = Number.isFinite(index) && index > 0 ? index : 1;
  return `posts/${safeSlug}/${safeBatch}-${safeIndex}.jpg`;
};

export const POST: APIRoute = async ({ locals, request }) => {
  const env = getRuntimeEnv(locals);
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
  const form = await request.formData().catch(() => null);
  if (!form) {
    return json(
      { ok: false, error: "Invalid form data", detail: "Form data is required.", code: "INVALID_FORM_DATA" },
      400
    );
  }

  try {
    const file = form.get("file");
    const slug = typeof form.get("slug") === "string" ? String(form.get("slug")) : "untitled";
    const meta = typeof form.get("meta") === "string" ? String(form.get("meta")) : null;

    if (!(file instanceof File)) {
      return json(
        { ok: false, error: "Missing file", detail: "File is required.", code: "UPLOAD_FILE_MISSING" },
        400
      );
    }
    if (!file.type.startsWith("image/")) {
      return json(
        {
          ok: false,
          error: "Only images are supported",
          detail: "Unsupported file type.",
          code: "UPLOAD_FILE_INVALID",
        },
        400
      );
    }

    let parsedMeta: { width?: number; height?: number; sort_order?: number; batch_id?: number; index?: number } | null =
      null;
    try {
      parsedMeta = meta ? JSON.parse(meta) : null;
    } catch {
      parsedMeta = null;
    }
    const key = buildKey(slug, parsedMeta?.batch_id ?? Date.now(), parsedMeta?.index ?? 1);
    const contentType = file.type || "image/jpeg";
    const bucket = env.MEDIA;
    if (!bucket) {
      return json(
        {
          ok: false,
          error: "Missing MEDIA binding",
          detail: "R2 binding is required.",
          howToFix:
            "Add R2 binding named MEDIA in wrangler.jsonc and Cloudflare dashboard for two-against-the-world1, then redeploy.",
          code: "R2_BINDING_MISSING",
        },
        500
      );
    }

    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType },
    });

    const baseUrl = env.PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
    const url = baseUrl ? `${baseUrl}/${key}` : key;

    const db = getDb(locals);
    const allowBootstrap = isSchemaBootstrapEnabled(env);
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

    return json({
      ok: true,
      url,
      key,
      warning: baseUrl
        ? undefined
        : "PUBLIC_R2_BASE_URL is not set. Set it to return fully-qualified image URLs.",
      howToFix: baseUrl
        ? undefined
        : "Set PUBLIC_R2_BASE_URL in two-against-the-world1 variables (e.g. https://<account>.r2.dev/<bucket>).",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return json({ ok: false, error: message, detail: message, code: "UPLOAD_FAILED" }, 500);
  }
};
