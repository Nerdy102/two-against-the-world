import type { APIRoute } from "astro";
import { ensureCommentsSchema, getDb } from "../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";
import { normalizeCommentStatus } from "../../../../lib/constants";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const PUT: APIRoute = async ({ locals, params, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized", code: "ADMIN_UNAUTHORIZED" }, 401);
  }
  if (!verifyCsrf(request)) {
    return json({ error: "Unauthorized", code: "ADMIN_CSRF_INVALID" }, 401);
  }
  const id = params.id;
  if (!id) return json({ error: "Missing id", code: "COMMENT_ID_MISSING" }, 400);
  const payload = await request.json().catch(() => null);
  if (!payload) return json({ error: "Invalid JSON", code: "INVALID_JSON" }, 400);
  const status = typeof payload.status === "string" ? payload.status : "";
  const normalized = normalizeCommentStatus(status);
  if (!normalized) return json({ error: "Missing status", code: "COMMENT_STATUS_INVALID" }, 400);
  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensureCommentsSchema(db, { allowBootstrap });
    await db
      .prepare(`UPDATE comments SET status = ? WHERE id = ?`)
      .bind(normalized, id)
      .run();
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update comment.";
    return json({ error: message, code: "COMMENT_UPDATE_FAILED" }, 500);
  }
};

export const DELETE: APIRoute = async ({ locals, params, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized", code: "ADMIN_UNAUTHORIZED" }, 401);
  }
  if (!verifyCsrf(request)) {
    return json({ error: "Unauthorized", code: "ADMIN_CSRF_INVALID" }, 401);
  }
  const id = params.id;
  if (!id) return json({ error: "Missing id", code: "COMMENT_ID_MISSING" }, 400);
  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensureCommentsSchema(db, { allowBootstrap });
    await db.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete comment.";
    return json({ error: message, code: "COMMENT_DELETE_FAILED" }, 500);
  }
};
