import type { APIRoute } from "astro";
import {
  buildAdminSessionCookies,
  checkAdminLoginRateLimit,
  clearAdminLoginFailures,
  createAdminSession,
  getAdminPassword,
  recordAdminLoginFailure,
  verifyAdminPassword,
} from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200, headers?: Headers) => {
  const responseHeaders = headers ?? new Headers();
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "application/json");
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const payload = await request.json().catch(() => null);
    if (!payload) {
      return json(
        { error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
        400
      );
    }

    const password = typeof payload.password === "string" ? payload.password : "";

    if (!password) {
      return json(
        { error: "Missing password", detail: "Password is required.", code: "ADMIN_PASSWORD_MISSING" },
        400
      );
    }
    const adminPassword = locals.runtime?.env?.ADMIN_PASSWORD ?? getAdminPassword(locals);
    console.info("[admin:unlock] hasAdminPassword=%s", Boolean(adminPassword));
    if (!adminPassword) {
      return json(
        {
          error: "Missing ADMIN_PASSWORD",
          detail: "ADMIN_PASSWORD is not set in runtime env.",
          howToFixProd: "Set it in Cloudflare Worker Variables/Secrets",
          howToFixLocal: "Set it in .dev.vars for wrangler dev",
          code: "ADMIN_PASSWORD_ENV_MISSING",
        },
        400
      );
    }
    if (!locals.runtime?.env?.DB) {
      return json(
        { error: "Missing DB binding", detail: "DB binding is required.", code: "DB_BINDING_MISSING" },
        500
      );
    }

    const rateLimit = await checkAdminLoginRateLimit(request, locals);
    if (!rateLimit.allowed) {
      const headers = new Headers({ "content-type": "application/json" });
      if (rateLimit.retryAfter) {
        headers.set("retry-after", String(rateLimit.retryAfter));
      }
      return json(
        {
          error: "Too many attempts. Try again later.",
          detail: "Rate limit exceeded.",
          code: "ADMIN_RATE_LIMIT",
        },
        429,
        headers
      );
    }

    const user = await verifyAdminPassword(locals, password);
    if (!user) {
      await recordAdminLoginFailure(request, locals);
      return json(
        { error: "Wrong password", detail: "Password mismatch.", code: "ADMIN_PASSWORD_INVALID" },
        401
      );
    }

    await clearAdminLoginFailures(request, locals);
    const session = await createAdminSession(locals, user.id);
    const csrfToken = crypto.randomUUID();
    const secure = request.url.startsWith("https://");
    const [sessionCookie, csrfCookie] = buildAdminSessionCookies(session.token, csrfToken, secure);
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("set-cookie", sessionCookie);
    headers.append("set-cookie", csrfCookie);
    return json({ ok: true, authenticated: true }, 200, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error.";
    if (message.includes("D1 database binding not found")) {
      return json(
        { error: "Missing DB binding", detail: "DB binding is required.", code: "DB_BINDING_MISSING" },
        500
      );
    }
    if (message.startsWith('D1 schema missing for "')) {
      return json(
        {
          error: "Missing DB schema; apply migrations locally",
          detail: message,
          code: "DB_SCHEMA_MISSING",
        },
        500
      );
    }
    console.error("[admin:unlock] error", message);
    return json({ error: message, detail: message, code: "ADMIN_UNLOCK_FAILED" }, 500);
  }
};
