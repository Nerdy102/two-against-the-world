import type { APIRoute } from "astro";
import { ensureCommentsSchema, getDb } from "../../../../lib/d1";
import { requireAdminSession } from "../../../../lib/adminAuth";
import { COMMENT_STATUSES, normalizeCommentStatus } from "../../../../lib/constants";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const GET: APIRoute = async ({ locals, request, url }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json(
      { ok: false, error: "Unauthorized", detail: "Admin session required.", code: "ADMIN_UNAUTHORIZED" },
      401
    );
  }
  try {
    const statusParam = url.searchParams.get("status");
    const slug = url.searchParams.get("slug");
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensureCommentsSchema(db, { allowBootstrap });
    const params: unknown[] = [];
    let where = "1=1";
    if (statusParam) {
      const normalized = normalizeCommentStatus(statusParam);
      if (!normalized || !COMMENT_STATUSES.includes(normalized)) {
        return json(
          { ok: false, error: "Invalid status", detail: "Status not allowed.", code: "COMMENT_STATUS_INVALID" },
          400
        );
      }
      where += " AND status = ?";
      params.push(normalized);
    }
    if (slug) {
      where += " AND post_slug = ?";
      params.push(slug);
    }
    const { results } = await db
      .prepare(
        `SELECT id, post_slug, parent_id, display_name, body, status, created_at
         FROM comments
         WHERE ${where}
         ORDER BY datetime(created_at) DESC
         LIMIT 300`
      )
      .bind(...params)
      .all();
    return json({ ok: true, comments: results ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load comments.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_COMMENTS_FETCH_FAILED" }, 500);
  }
};
