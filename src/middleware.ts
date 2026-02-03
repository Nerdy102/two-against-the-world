import type { MiddlewareHandler } from "astro";

export const onRequest: MiddlewareHandler = async ({ locals, request }, next) => {
  const response = await next();
  const disableCache = locals.runtime?.env?.DISABLE_HTML_CACHE === "true";
  if (!disableCache) return response;

  const accept = request.headers.get("accept") ?? "";
  const contentType = response.headers.get("content-type") ?? "";
  const isHtml = accept.includes("text/html") || contentType.includes("text/html");
  if (!isHtml) return response;

  const updated = new Response(response.body, response);
  updated.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return updated;
};
