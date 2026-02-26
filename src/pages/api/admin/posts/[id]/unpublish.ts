import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb } from "../../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

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
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensurePostsSchema(db, { allowBootstrap });
    await db
      .prepare(
        `UPDATE posts
         SET status = 'draft',
             published_at = NULL,
             published_tz = NULL,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(id)
      .run();

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unpublish post.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_POST_UNPUBLISH_FAILED" }, 500);
  }
};
