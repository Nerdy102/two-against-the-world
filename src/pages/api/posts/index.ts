import type { APIRoute } from "astro";
import { ensurePostsSchema, getDb, type PostRecord } from "../../../lib/d1";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const db = getDb(locals);
  await ensurePostsSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, slug, title, summary, cover_url, status, author, topic, published_at, created_at, updated_at
       FROM posts
       WHERE status = 'published'
       ORDER BY datetime(published_at) DESC`
    )
    .all<PostRecord>();

  return new Response(JSON.stringify({ posts: results ?? [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
