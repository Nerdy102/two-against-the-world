import type { APIRoute } from "astro";
import { ensureReactionsSchema, getDb } from "../../../lib/d1";
import { isReactionKind } from "../../../lib/constants";
import { getRuntimeEnv, isSchemaBootstrapEnabled } from "../../../lib/runtimeEnv";

export const prerender = false;

const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

export const GET: APIRoute = async ({ locals, url }) => {
  const env = getRuntimeEnv(locals);
  const slug = url.searchParams.get("slug");
  const kind = url.searchParams.get("kind");
  if (!slug) {
    return json(
      { ok: false, error: "Missing slug", detail: "slug is required.", code: "REACTION_SLUG_MISSING" },
      400
    );
  }
  if (kind && !isReactionKind(kind)) {
    return json(
      { ok: false, error: "Invalid reaction kind", detail: "Reaction not allowed.", code: "REACTION_KIND_INVALID" },
      400
    );
  }

  try {
    const db = getDb(locals);
    const allowBootstrap = isSchemaBootstrapEnabled(env);
    await ensureReactionsSchema(db, { allowBootstrap });
    if (kind) {
      const { results } = await db
        .prepare(
          `SELECT count
           FROM reactions
           WHERE post_slug = ? AND kind = ?`
        )
        .bind(slug, kind)
        .all<{ count: number }>();
      const count = Number(results?.[0]?.count ?? 0);
      return json({ ok: true, count });
    }

    const { results } = await db
      .prepare(
        `SELECT kind, count
         FROM reactions
         WHERE post_slug = ?`
      )
      .bind(slug)
      .all<{ kind: string; count: number }>();

    const counts = results?.reduce<Record<string, number>>((acc, row) => {
      acc[row.kind] = Number(row.count ?? 0);
      return acc;
    }, {}) ?? {};

    const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);

    return json({ ok: true, counts, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reactions.";
    if (message.includes("D1 database binding not found")) {
      return json(
        {
          ok: false,
          error: "Missing DB binding",
          detail: "Check wrangler D1 bindings.",
          howToFix:
            "Add D1 binding named DB in wrangler.jsonc and Cloudflare dashboard for two-against-the-world1, then redeploy.",
          code: "DB_BINDING_MISSING",
        },
        500
      );
    }
    return json({ ok: false, error: message, detail: message, code: "REACTIONS_FETCH_FAILED" }, 500);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const env = getRuntimeEnv(locals);
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json(
      { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
      400
    );
  }

  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const kind = typeof payload.kind === "string" ? payload.kind.trim() : "";
  if (!slug) {
    return json(
      { ok: false, error: "Missing slug", detail: "slug is required.", code: "REACTION_SLUG_MISSING" },
      400
    );
  }
  if (!kind) {
    return json(
      { ok: false, error: "Missing kind", detail: "kind is required.", code: "REACTION_KIND_MISSING" },
      400
    );
  }
  if (!isReactionKind(kind)) {
    return json(
      { ok: false, error: "Invalid reaction kind", detail: "Reaction not allowed.", code: "REACTION_KIND_INVALID" },
      400
    );
  }

  try {
    const db = getDb(locals);
    const allowBootstrap = isSchemaBootstrapEnabled(env);
    await ensureReactionsSchema(db, { allowBootstrap });
    await db
      .prepare(
        `INSERT INTO reactions (id, post_slug, kind, count, updated_at)
         VALUES (?, ?, ?, 1, datetime('now'))
         ON CONFLICT(post_slug, kind)
         DO UPDATE SET count = count + 1, updated_at = datetime('now')`
      )
      .bind(crypto.randomUUID(), slug, kind)
      .run();

    const { results } = await db
      .prepare(
        `SELECT kind, count
         FROM reactions
         WHERE post_slug = ?`
      )
      .bind(slug)
      .all<{ kind: string; count: number }>();

    const counts = results?.reduce<Record<string, number>>((acc, row) => {
      acc[row.kind] = Number(row.count ?? 0);
      return acc;
    }, {}) ?? {};

    const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);

    return json({ ok: true, counts, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update reaction.";
    if (message.includes("D1 database binding not found")) {
      return json(
        {
          ok: false,
          error: "Missing DB binding",
          detail: "Check wrangler D1 bindings.",
          howToFix:
            "Add D1 binding named DB in wrangler.jsonc and Cloudflare dashboard for two-against-the-world1, then redeploy.",
          code: "DB_BINDING_MISSING",
        },
        500
      );
    }
    return json({ ok: false, error: message, detail: message, code: "REACTION_UPDATE_FAILED" }, 500);
  }
};
