import type { APIRoute } from "astro";
import { getDb, type PostRecord } from "../../../lib/d1";

export const prerender = false;

export const GET: APIRoute = async ({ locals, params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(
      JSON.stringify({
        error: "Missing slug",
        detail: "slug param is required.",
        code: "POST_SLUG_MISSING",
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
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
      return new Response(
        JSON.stringify({ error: "Not found", detail: "Post not found.", code: "POST_NOT_FOUND" }),
        {
          status: 404,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ post: record }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load post.";
    return new Response(
      JSON.stringify({
        error: "Missing DB binding",
        detail: message,
        howToFix:
          "Add D1 binding named DB in wrangler.jsonc and Cloudflare dashboard, then redeploy.",
        code: "DB_BINDING_MISSING",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};
