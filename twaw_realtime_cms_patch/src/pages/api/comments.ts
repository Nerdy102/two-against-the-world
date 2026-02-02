import type { APIRoute } from "astro";
import { getClientIp, hashIp } from "../../lib/server/ip";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

function clamp(s: string, max: number): string {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max) : t;
}

async function verifyTurnstile(token: string, ip: string | null, env: Env): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not enabled
  if (!token) return false;
  const form = new URLSearchParams();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!resp.ok) return false;
  const data = (await resp.json()) as { success?: boolean };
  return data.success === true;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const env = locals.runtime.env as Env;
  const slug = clamp(url.searchParams.get("slug") || "", 140);
  if (!slug) return json({ error: "missing_slug" }, { status: 400 });

  const after = Number(url.searchParams.get("after") || "0");
  const afterSafe = Number.isFinite(after) && after > 0 ? after : 0;

  const res = await env.DB
    .prepare(
      "SELECT id, name, message, created_at FROM comments WHERE post_slug = ? AND status = 'visible' AND created_at > ? ORDER BY created_at ASC LIMIT 200"
    )
    .bind(slug, afterSafe)
    .all();

  const comments = (res.results ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name),
    message: String(r.message),
    created_at: Number(r.created_at),
  }));

  return json({ comments });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const slug = clamp(body?.slug || "", 140);
  const name = clamp(body?.name || "", 32);
  const message = clamp(body?.message || "", 1200);
  const token = clamp(body?.turnstileToken || "", 2048);

  if (!slug || !name || !message) {
    return json({ error: "missing_fields" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ip_hash = await hashIp(ip, env);

  // Simple rate limit: 1 comment / 15 seconds per IP.
  if (ip_hash) {
    const last = await env.DB
      .prepare("SELECT created_at FROM comments WHERE ip_hash = ? ORDER BY created_at DESC LIMIT 1")
      .bind(ip_hash)
      .first();

    const lastAt = last?.created_at ? Number(last.created_at) : 0;
    if (lastAt && Date.now() - lastAt < 15_000) {
      return json({ error: "rate_limited" }, { status: 429 });
    }
  }

  const ok = await verifyTurnstile(token, ip, env);
  if (!ok) return json({ error: "turnstile_failed" }, { status: 403 });

  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB
    .prepare(
      "INSERT INTO comments (id, post_slug, name, message, created_at, status, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, 'visible', ?, ?)"
    )
    .bind(id, slug, name, message, now, ip_hash, request.headers.get("User-Agent"))
    .run();

  return json({
    comment: {
      id,
      name,
      message,
      created_at: now,
    },
  });
};
