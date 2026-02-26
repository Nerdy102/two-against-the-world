import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb } from "../../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

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

export const POST: APIRoute = async ({ locals, params, request }) => {
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
    const payload = await request.json().catch(() => ({}));
    const publishedAt = normalizeDateTime(payload?.published_at);
    const publishedTz = normalizeTimeZone(payload?.published_tz);
    const fallbackPublishedAt = new Date().toISOString();
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    await db
      .prepare(
        `UPDATE posts
         SET status = 'published',
             published_at = COALESCE(?, published_at, ?),
             published_tz = COALESCE(?, published_tz),
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(publishedAt, fallbackPublishedAt, publishedTz, id)
      .run();

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish post.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_POST_PUBLISH_FAILED" }, 500);
  }
};
