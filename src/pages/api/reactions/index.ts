import type { APIRoute } from "astro";
import { ensureReactionsSchema, getDb } from "../../../lib/d1";
import { isReactionKind } from "../../../lib/constants";

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
  const kind = url.searchParams.get("kind");
  if (!slug) {
    return json(
      { error: "Missing slug", detail: "slug is required.", code: "REACTION_SLUG_MISSING" },
      400
    );
  }
  if (kind && !isReactionKind(kind)) {
    return json(
      { error: "Invalid reaction kind", detail: "Reaction not allowed.", code: "REACTION_KIND_INVALID" },
      400
    );
  }

  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensureReactionsSchema(db, { allowBootstrap });
    if (kind) {
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
    }

    const { results } = await db
      .prepare(
        `SELECT kind, COUNT(*) as count
         FROM reactions
         WHERE post_slug = ?
         GROUP BY kind`
      )
      .bind(slug)
      .all<{ kind: string; count: number }>();

    const counts = results?.reduce<Record<string, number>>((acc, row) => {
      acc[row.kind] = Number(row.count ?? 0);
      return acc;
    }, {}) ?? {};

    const visitorId = getVisitorId(request);
    let reactedKinds: string[] = [];
    if (visitorId) {
      const { results: reactedRows } = await db
        .prepare(
          `SELECT kind
           FROM reactions
           WHERE post_slug = ? AND visitor_id = ?`
        )
        .bind(slug, visitorId)
        .all<{ kind: string }>();
      reactedKinds = reactedRows?.map((row) => row.kind) ?? [];
    }

    const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);

    return json({ counts, reactedKinds, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reactions.";
    return json({ error: message, detail: message, code: "REACTIONS_FETCH_FAILED" }, 500);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json(
      { error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
      400
    );
  }

  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const kind = typeof payload.kind === "string" ? payload.kind.trim() : "";
  if (!slug) {
    return json(
      { error: "Missing slug", detail: "slug is required.", code: "REACTION_SLUG_MISSING" },
      400
    );
  }
  if (!kind) {
    return json(
      { error: "Missing kind", detail: "kind is required.", code: "REACTION_KIND_MISSING" },
      400
    );
  }
  if (!isReactionKind(kind)) {
    return json(
      { error: "Invalid reaction kind", detail: "Reaction not allowed.", code: "REACTION_KIND_INVALID" },
      400
    );
  }

  try {
    const db = getDb(locals);
    const allowBootstrap = locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";
    await ensureReactionsSchema(db, { allowBootstrap });
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
        `SELECT kind, COUNT(*) as count
         FROM reactions
         WHERE post_slug = ?
         GROUP BY kind`
      )
      .bind(slug)
      .all<{ kind: string; count: number }>();

    const counts = results?.reduce<Record<string, number>>((acc, row) => {
      acc[row.kind] = Number(row.count ?? 0);
      return acc;
    }, {}) ?? {};

    const { results: reactedRows } = await db
      .prepare(
        `SELECT kind
         FROM reactions
         WHERE post_slug = ? AND visitor_id = ?`
      )
      .bind(slug, visitorId)
      .all<{ kind: string }>();

    const reactedKinds = reactedRows?.map((row) => row.kind) ?? [];
    const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);

    return json(
      { counts, reactedKinds, total },
      200,
      setCookieHeader ? { "set-cookie": setCookieHeader } : undefined
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update reaction.";
    return json({ error: message, detail: message, code: "REACTION_UPDATE_FAILED" }, 500);
  }
};
