import type { APIRoute } from "astro";
import { ensureCommentsSchema, getDb } from "../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";
import { normalizeCommentStatus } from "../../../../lib/constants";
import { getRuntimeEnv, isSchemaBootstrapEnabled } from "../../../../lib/runtimeEnv";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

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
      { ok: false, error: "Missing id", detail: "Comment id is required.", code: "COMMENT_ID_MISSING" },
      400
    );
  }
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json(
      { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
      400
    );
  }
  const status = typeof payload.status === "string" ? payload.status : "";
  const normalized = normalizeCommentStatus(status);
  if (!normalized) {
    return json(
      { ok: false, error: "Missing status", detail: "Status is required.", code: "COMMENT_STATUS_INVALID" },
      400
    );
  }
  try {
    const env = getRuntimeEnv(locals);
    const db = getDb(locals);
    const allowBootstrap = isSchemaBootstrapEnabled(env);
    await ensureCommentsSchema(db, { allowBootstrap });
    await db
      .prepare(`UPDATE comments SET status = ? WHERE id = ?`)
      .bind(normalized, id)
      .run();
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update comment.";
    return json({ ok: false, error: message, detail: message, code: "COMMENT_UPDATE_FAILED" }, 500);
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
      { ok: false, error: "Missing id", detail: "Comment id is required.", code: "COMMENT_ID_MISSING" },
      400
    );
  }
  try {
    const env = getRuntimeEnv(locals);
    const db = getDb(locals);
    const allowBootstrap = isSchemaBootstrapEnabled(env);
    await ensureCommentsSchema(db, { allowBootstrap });
    await db.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete comment.";
    return json({ ok: false, error: message, detail: message, code: "COMMENT_DELETE_FAILED" }, 500);
  }
};
