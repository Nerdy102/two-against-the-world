import type { APIRoute } from "astro";
import { getDb } from "../../../lib/d1";

export const prerender = false;

const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const parseCookies = (cookieHeader: string | null) => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    cookies[key] = decodeURIComponent(rest.join("="));
  });
  return cookies;
};

const getVisitorId = (request: Request) => {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies["tatw_visitor_id"];
};

export const GET: APIRoute = async ({ locals, request, url }) => {
  const slug = url.searchParams.get("slug");
  const kind = url.searchParams.get("kind") ?? "heart";
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }

  const db = getDb(locals);
  const { results } = await db
    .prepare(
      `SELECT COUNT(*) as count
       FROM reactions
       WHERE post_slug = ? AND kind = ?`
    )
    .bind(slug, kind)
    .all<{ count: number }>();
  const count = Number(results?.[0]?.count ?? 0);

  const visitorId = getVisitorId(request);
  let reacted = false;
  if (visitorId) {
    const existing = await db
      .prepare(
        `SELECT id
         FROM reactions
         WHERE post_slug = ? AND kind = ? AND visitor_id = ?
         LIMIT 1`
      )
      .bind(slug, kind, visitorId)
      .first<{ id: string }>();
    reacted = Boolean(existing?.id);
  }

  return json({ count, reacted });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const kind = typeof payload.kind === "string" ? payload.kind.trim() : "heart";
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }

  const db = getDb(locals);
  let visitorId = getVisitorId(request);
  let setCookieHeader: string | undefined;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    setCookieHeader = `tatw_visitor_id=${visitorId}; Path=/; SameSite=Lax; Max-Age=31536000`;
  }

  const existing = await db
    .prepare(
      `SELECT id
       FROM reactions
       WHERE post_slug = ? AND kind = ? AND visitor_id = ?
       LIMIT 1`
    )
    .bind(slug, kind, visitorId)
    .first<{ id: string }>();

  if (existing?.id) {
    await db
      .prepare(`DELETE FROM reactions WHERE id = ?`)
      .bind(existing.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO reactions (id, post_slug, kind, visitor_id)
         VALUES (?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), slug, kind, visitorId)
      .run();
  }

  const { results } = await db
    .prepare(
      `SELECT COUNT(*) as count
       FROM reactions
       WHERE post_slug = ? AND kind = ?`
    )
    .bind(slug, kind)
    .all<{ count: number }>();

  const count = Number(results?.[0]?.count ?? 0);
  const reacted = !existing?.id;

  return json({ count, reacted }, 200, setCookieHeader ? { "set-cookie": setCookieHeader } : undefined);
};
