import type { APIRoute } from "astro";

export const prerender = false;

const normalizeKey = (value: string) =>
  value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");

const isInvalidKey = (value: string) =>
  !value || value.includes("..") || value.includes("\\") || value.startsWith(".");

export const GET: APIRoute = async ({ params, locals, request }) => {
  const raw = typeof params.key === "string" ? params.key : "";
  const key = normalizeKey(raw);
  if (isInvalidKey(key)) {
    return new Response("Invalid media key", { status: 400 });
  }

  const bucket = locals.runtime?.env?.MEDIA;
  if (!bucket) {
    return new Response("R2 binding is missing", { status: 500 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  const metadata = object.httpMetadata;
  if (metadata?.contentType) headers.set("content-type", metadata.contentType);
  if (metadata?.contentDisposition) headers.set("content-disposition", metadata.contentDisposition);
  if (metadata?.contentEncoding) headers.set("content-encoding", metadata.contentEncoding);
  if (metadata?.contentLanguage) headers.set("content-language", metadata.contentLanguage);
  if (metadata?.cacheControl) headers.set("cache-control", metadata.cacheControl);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && (ifNoneMatch === object.httpEtag || ifNoneMatch === `"${object.httpEtag}"`)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response((object.body ?? null) as unknown as BodyInit, { status: 200, headers });
};

export const HEAD: APIRoute = async (ctx) => {
  const res = await GET(ctx);
  return new Response(null, { status: res.status, headers: res.headers });
};
