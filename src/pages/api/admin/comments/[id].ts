import type { APIRoute } from "astro";
import { ensureCommentsSchema, getDb } from "../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const PUT: APIRoute = async ({ locals, params, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!verifyCsrf(request)) {
    return json({ error: "Unauthorized" }, 401);
  }
  const id = params.id;
  if (!id) return json({ error: "Missing id" }, 400);
  const payload = await request.json().catch(() => null);
  if (!payload) return json({ error: "Invalid JSON" }, 400);
  const status = typeof payload.status === "string" ? payload.status : "";
  if (!status) return json({ error: "Missing status" }, 400);
  const db = getDb(locals);
  await ensureCommentsSchema(db);
  await db
    .prepare(`UPDATE comments SET status = ? WHERE id = ?`)
    .bind(status, id)
    .run();
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, params, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!verifyCsrf(request)) {
    return json({ error: "Unauthorized" }, 401);
  }
  const id = params.id;
  if (!id) return json({ error: "Missing id" }, 400);
  const db = getDb(locals);
  await ensureCommentsSchema(db);
  await db.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run();
  return json({ ok: true });
};
