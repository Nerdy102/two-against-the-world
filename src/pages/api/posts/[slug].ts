import type { APIRoute } from "astro";
import { getDb, type PostRecord } from "../../../lib/d1";

export const prerender = false;

export const GET: APIRoute = async ({ locals, params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const db = getDb(locals);
  const record = await db
    .prepare(
      `SELECT *
       FROM posts
       WHERE slug = ? AND status = 'published'
       LIMIT 1`
    )
    .bind(slug)
    .first<PostRecord>();

  if (!record) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ post: record }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
