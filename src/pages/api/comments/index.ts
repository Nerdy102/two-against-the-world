import type { APIRoute } from "astro";
import { ensureCommentsSchema, getDb, type CommentRecord } from "../../../lib/d1";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const hashIp = async (ip: string) => {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const verifyTurnstile = async (secret: string, token: string | null, remoteIp?: string | null) => {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return Boolean(data?.success);
};

export const GET: APIRoute = async ({ locals, url }) => {
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }
  const db = getDb(locals);
  await ensureCommentsSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, post_slug, parent_id, display_name, body, status, created_at
       FROM comments
       WHERE post_slug = ? AND status = 'visible'
       ORDER BY datetime(created_at) DESC
       LIMIT 200`
    )
    .bind(slug)
    .all<CommentRecord>();
  return json({ comments: results ?? [] });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const displayName =
    typeof payload.displayName === "string"
      ? payload.displayName.trim()
      : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const parentId =
    typeof payload.parentId === "string" ? payload.parentId.trim() : null;
  const turnstileToken =
    typeof payload.turnstileToken === "string" ? payload.turnstileToken : null;

  if (!slug || !displayName || !body) {
    return json({ error: "Missing fields" }, 400);
  }

  const db = getDb(locals);
  await ensureCommentsSchema(db);
  const id = crypto.randomUUID();
  const post = await db
    .prepare(`SELECT status FROM posts WHERE slug = ? LIMIT 1`)
    .bind(slug)
    .first<{ status: string }>();
  if (!post || post.status !== "published") {
    return json({ error: "Post not available" }, 400);
  }
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const ipHash = ip ? await hashIp(ip) : null;
  const secret = locals.runtime?.env?.TURNSTILE_SECRET;
  if (secret) {
    if (!turnstileToken) return json({ error: "Turnstile required" }, 400);
    const ok = await verifyTurnstile(secret, turnstileToken, ip);
    if (!ok) return json({ error: "Turnstile failed" }, 400);
  }

  if (ipHash) {
    const { results } = await db
      .prepare(
        `SELECT COUNT(*) as count
         FROM comments
         WHERE ip_hash = ? AND datetime(created_at) > datetime('now', '-5 minutes')`
      )
      .bind(ipHash)
      .all<{ count: number }>();
    const count = Number(results?.[0]?.count ?? 0);
    if (count >= 5) {
      return json({ error: "Too many comments, slow down." }, 429);
    }
  }

  await db
    .prepare(
      `INSERT INTO comments (id, post_slug, parent_id, display_name, body, status, ip_hash)
       VALUES (?, ?, ?, ?, ?, 'visible', ?)`
    )
    .bind(id, slug, parentId, displayName, body, ipHash)
    .run();

  return json({ ok: true, id });
};
