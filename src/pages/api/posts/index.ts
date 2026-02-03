import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb, type PostRecord } from "../../../lib/d1";
import { getRuntimeEnv, isSchemaBootstrapEnabled } from "../../../lib/runtimeEnv";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const env = getRuntimeEnv(locals);
    const db = getDb(locals);
    const allowBootstrap = isSchemaBootstrapEnabled(env);
    await ensurePostsSchema(db, { allowBootstrap });
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const likeQuery = `%${query}%`;
    const statement = query
      ? db.prepare(
          `SELECT id, slug, title, summary, cover_url, status, author_name, topic, published_at, created_at, updated_at
           FROM posts
           WHERE status = 'published'
             AND (
               LOWER(title) LIKE ?
               OR LOWER(COALESCE(summary, '')) LIKE ?
               OR LOWER(COALESCE(body_markdown, '')) LIKE ?
               OR LOWER(COALESCE(author_name, '')) LIKE ?
             )
           ORDER BY datetime(published_at) DESC`
        )
      : db.prepare(
          `SELECT id, slug, title, summary, cover_url, status, author_name, topic, published_at, created_at, updated_at
           FROM posts
           WHERE status = 'published'
           ORDER BY datetime(published_at) DESC`
        );
    const bound = query
      ? statement.bind(likeQuery, likeQuery, likeQuery, likeQuery)
      : statement;
    const { results } = await bound.all<PostRecord>();

    return new Response(JSON.stringify({ posts: results ?? [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load posts.";
    if (message.includes("D1 database binding not found")) {
      return new Response(
        JSON.stringify({
          error: "Missing DB binding",
          detail: "Check wrangler D1 bindings.",
          howToFix:
            "Add D1 binding named DB in wrangler.jsonc and Cloudflare dashboard for two-against-the-world1, then redeploy.",
          code: "DB_BINDING_MISSING",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      );
    }
    return new Response(JSON.stringify({ error: message, detail: message, code: "POSTS_FETCH_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
