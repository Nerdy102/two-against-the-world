import type { APIRoute } from "astro";
import {
  ensureAdminSchema,
  ensureCommentsSchema,
  getDb,
  type CommentRecord,
} from "../../../lib/d1";
import { normalizeCommentStatus } from "../../../lib/constants";

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

export const GET: APIRoute = async ({ locals, url }) => {
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return json(
      { ok: false, error: "Missing slug", detail: "slug is required.", code: "COMMENT_SLUG_MISSING" },
      400
    );
  }
  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensureCommentsSchema(db, { allowBootstrap });
    await ensureAdminSchema(db, { allowBootstrap });
    const publicStatus: CommentRecord["status"] = "visible";
    const { results } = await db
      .prepare(
        `SELECT id, post_slug, parent_id, display_name, body, status, created_at
         FROM comments
         WHERE post_slug = ? AND status = ?
         ORDER BY datetime(created_at) ASC
         LIMIT 200`
      )
      .bind(slug, publicStatus)
      .all<CommentRecord>();
    return json({ ok: true, comments: results ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load comments.";
    if (message.includes("D1 database binding not found")) {
      return json(
        { ok: false, error: "Missing DB binding", detail: "Check wrangler D1 bindings.", code: "DB_BINDING_MISSING" },
        500
      );
    }
    if (message.startsWith('D1 schema missing for "')) {
      return json(
        {
          ok: false,
          error: "Missing DB schema; apply migrations locally",
          detail: message,
          code: "DB_SCHEMA_MISSING",
        },
        500
      );
    }
    return json({ ok: false, error: message, detail: message, code: "COMMENTS_FETCH_FAILED" }, 500);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json(
      { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
      400
    );
  }

  const slug = normalizeText(payload.slug || payload.postSlug);
  const displayName = normalizeText(payload.displayName);
  const body = normalizeText(payload.body);
  const parentId =
    typeof payload.parentId === "string" ? payload.parentId.trim() : null;
  const turnstileToken =
    typeof payload.turnstileToken === "string" ? payload.turnstileToken : null;

  if (!slug || !displayName || !body) {
    return json(
      {
        ok: false,
        error: "Missing fields",
        detail: "slug, displayName, and body are required.",
        code: "MISSING_FIELDS",
      },
      400
    );
  }
  if (displayName.length > 40 || body.length > 2000) {
    return json(
      {
        ok: false,
        error: "Comment too long",
        detail: "Nickname or message exceeds length limits.",
        code: "COMMENT_TOO_LONG",
      },
      400
    );
  }

  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensureCommentsSchema(db, { allowBootstrap });
    await ensureAdminSchema(db, { allowBootstrap });
    const id = crypto.randomUUID();
    const ip =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const ipHash = ip ? await hashIp(ip) : null;
    const userAgent = request.headers.get("user-agent") ?? "";
    const userAgentHash = userAgent ? await hashIp(userAgent) : null;
    const secret = locals.runtime?.env?.TURNSTILE_SECRET;
    if (secret) {
      if (!turnstileToken) {
        return json(
          { ok: false, error: "Turnstile required", detail: "Missing turnstile token.", code: "TURNSTILE_REQUIRED" },
          400
        );
      }
      const ok = await verifyTurnstile(secret, turnstileToken, ip);
      if (!ok) {
        return json(
          { ok: false, error: "Turnstile failed", detail: "Verification failed.", code: "TURNSTILE_FAILED" },
          400
        );
      }
    }

    if (ipHash) {
      const banned = await db
        .prepare(`SELECT id FROM comment_bans WHERE ip_hash = ? LIMIT 1`)
        .bind(ipHash)
        .first<{ id: string }>();
      if (banned?.id) {
        return json(
          {
            ok: false,
            error: "You are blocked from commenting.",
            detail: "Your IP is blocked.",
            code: "COMMENT_BLOCKED",
          },
          403
        );
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
        return json(
          { ok: false, error: "Too many comments, slow down.", detail: "Rate limit exceeded.", code: "COMMENT_RATE_LIMIT" },
          429
        );
      }
    }

    const status = normalizeCommentStatus("visible");
    if (!status) {
      return json(
        { ok: false, error: "Invalid comment status", detail: "Status not allowed.", code: "COMMENT_STATUS_INVALID" },
        400
      );
    }
    await db
      .prepare(
        `INSERT INTO comments (id, post_slug, parent_id, display_name, body, status, ip_hash, user_agent_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, slug, parentId, displayName, body, status, ipHash, userAgentHash)
      .run();

    return json({ ok: true, id, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit comment.";
    if (message.includes("D1 database binding not found")) {
      return json(
        { ok: false, error: "Missing DB binding", detail: "Check wrangler D1 bindings.", code: "DB_BINDING_MISSING" },
        500
      );
    }
    if (message.startsWith('D1 schema missing for "')) {
      return json(
        {
          ok: false,
          error: "Missing DB schema; apply migrations locally",
          detail: message,
          code: "DB_SCHEMA_MISSING",
        },
        500
      );
    }
    return json({ ok: false, error: message, detail: message, code: "COMMENTS_CREATE_FAILED" }, 500);
  }
};
