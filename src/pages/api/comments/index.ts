import type { APIRoute } from "astro";
import {
  ensureAdminSchema,
  ensureCommentsSchema,
  ensurePostsSchema,
  getDb,
  type CommentRecord,
} from "../../../lib/d1";

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

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const shouldHoldForReview = (body: string) => {
  const hasLink = /https?:\/\//i.test(body);
  return body.length > 500 || hasLink;
};

export const GET: APIRoute = async ({ locals, url }) => {
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }
  const db = getDb(locals);
  await ensureCommentsSchema(db);
  await ensureAdminSchema(db);
  await ensurePostsSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, post_slug, parent_id, display_name, body, status, created_at
       FROM comments
       WHERE post_slug = ? AND status IN ('approved', 'visible')
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

  const slug = normalizeText(payload.slug);
  const displayName = normalizeText(payload.displayName);
  const body = normalizeText(payload.body);
  const parentId =
    typeof payload.parentId === "string" ? payload.parentId.trim() : null;
  const turnstileToken =
    typeof payload.turnstileToken === "string" ? payload.turnstileToken : null;

  if (!slug || !displayName || !body) {
    return json({ error: "Missing fields" }, 400);
  }
  if (displayName.length > 60 || body.length > 2000) {
    return json({ error: "Comment too long" }, 400);
  }

  const db = getDb(locals);
  await ensureCommentsSchema(db);
  await ensureAdminSchema(db);
  await ensurePostsSchema(db);
  const id = crypto.randomUUID();
  const post = await db
    .prepare(`SELECT id, status FROM posts WHERE slug = ? LIMIT 1`)
    .bind(slug)
    .first<{ id: string; status: string }>();
  if (!post || post.status !== "published") {
    return json({ error: "Post not available" }, 400);
  }
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const ipHash = ip ? await hashIp(ip) : null;
  const userAgent = request.headers.get("user-agent") ?? "";
  const userAgentHash = userAgent ? await hashIp(userAgent) : null;
  const secret = locals.runtime?.env?.TURNSTILE_SECRET;
  if (secret) {
    if (!turnstileToken) return json({ error: "Turnstile required" }, 400);
    const ok = await verifyTurnstile(secret, turnstileToken, ip);
    if (!ok) return json({ error: "Turnstile failed" }, 400);
  }

  if (ipHash) {
    const banned = await db
      .prepare(`SELECT id FROM comment_bans WHERE ip_hash = ? LIMIT 1`)
      .bind(ipHash)
      .first<{ id: string }>();
    if (banned?.id) {
      return json({ error: "You are blocked from commenting." }, 403);
    }
  }

  if (ipHash) {
    const { results } = await db
      .prepare(
        `SELECT COUNT(*) as count
         FROM comments
         WHERE ip_hash = ? AND datetime(created_at) > datetime('now', '-10 minutes')`
      )
      .bind(ipHash)
      .all<{ count: number }>();
    const count = Number(results?.[0]?.count ?? 0);
    if (count >= 5) {
      return json({ error: "Too many comments, slow down." }, 429);
    }
  }

  const requireReview = locals.runtime?.env?.COMMENTS_REQUIRE_REVIEW === "true";
  const status = requireReview || shouldHoldForReview(body) ? "pending" : "approved";
  await db
    .prepare(
      `INSERT INTO comments (id, post_slug, post_id, parent_id, display_name, body, status, ip_hash, user_agent_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, slug, post.id, parentId, displayName, body, status, ipHash, userAgentHash)
    .run();

  return json({ ok: true, id, status });
};
