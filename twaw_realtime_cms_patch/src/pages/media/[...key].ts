import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params, locals, request }) => {
  const env = locals.runtime.env as Env;

  const key = (params.key || "").toString();
  if (!key) return new Response("Not found", { status: 404 });

  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  const ct = obj.httpMetadata?.contentType || "application/octet-stream";
  headers.set("Content-Type", ct);

  // Strong caching is ok for immutable keys (uuid-based keys). If you want to allow replacing files, lower this.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (obj.etag) headers.set("ETag", obj.etag);

  // Support If-None-Match
  const inm = request.headers.get("If-None-Match");
  if (inm && obj.etag && inm === obj.etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(obj.body, { headers });
};
