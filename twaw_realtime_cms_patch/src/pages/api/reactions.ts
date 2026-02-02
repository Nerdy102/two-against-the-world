import type { APIRoute } from "astro";

const VISITOR_COOKIE = "twaw_vid";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const parts = cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    const [k, ...rest] = part.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function makeVisitorCookie(id: string): string {
  // 1 year
  return `${VISITOR_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; HttpOnly; Secure; SameSite=Lax`;
}

async function getCounts(db: D1Database, slug: string): Promise<Record<string, number>> {
  const res = await db
    .prepare("SELECT type, COUNT(*) as count FROM reactions WHERE post_slug = ? GROUP BY type")
    .bind(slug)
    .all();

  const out: Record<string, number> = {};
  for (const r of res.results ?? []) {
    out[String((r as any).type)] = Number((r as any).count ?? 0);
  }
  return out;
}

export const GET: APIRoute = async ({ url, request, locals }) => {
  const env = locals.runtime.env as Env;
  const slug = (url.searchParams.get("slug") || "").trim().slice(0, 140);
  if (!slug) return json({ error: "missing_slug" }, { status: 400 });

  let visitorId = getCookie(request, VISITOR_COOKIE);
  const headers: HeadersInit = {};
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    headers["Set-Cookie"] = makeVisitorCookie(visitorId);
  }

  const counts = await getCounts(env.DB, slug);

  const exists = await env.DB
    .prepare("SELECT 1 FROM reactions WHERE post_slug = ? AND visitor_id = ? AND type = 'heart' LIMIT 1")
    .bind(slug, visitorId)
    .first();

  return json(
    {
      counts,
      reacted: Boolean(exists),
    },
    { headers }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const slug = String(body?.slug || "").trim().slice(0, 140);
  const type = String(body?.type || "heart").trim().slice(0, 20);
  if (!slug) return json({ error: "missing_slug" }, { status: 400 });

  let visitorId = getCookie(request, VISITOR_COOKIE);
  const headers: HeadersInit = {};
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    headers["Set-Cookie"] = makeVisitorCookie(visitorId);
  }

  // Toggle
  const existing = await env.DB
    .prepare("SELECT 1 FROM reactions WHERE post_slug = ? AND visitor_id = ? AND type = ? LIMIT 1")
    .bind(slug, visitorId, type)
    .first();

  if (existing) {
    await env.DB
      .prepare("DELETE FROM reactions WHERE post_slug = ? AND visitor_id = ? AND type = ?")
      .bind(slug, visitorId, type)
      .run();
  } else {
    await env.DB
      .prepare("INSERT INTO reactions (post_slug, visitor_id, type, created_at) VALUES (?, ?, ?, ?)")
      .bind(slug, visitorId, type, Date.now())
      .run();
  }

  const counts = await getCounts(env.DB, slug);

  return json(
    {
      counts,
      reacted: !existing,
    },
    { headers }
  );
};
