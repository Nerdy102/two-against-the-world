import type { APIRoute } from "astro";
import {
  buildAdminSessionCookies,
  checkAdminLoginRateLimit,
  clearAdminLoginFailures,
  createAdminSession,
  recordAdminLoginFailure,
  getAdminPassword,
  isSecureRequest,
  verifyAdminPassword,
} from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200, headers?: Headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: headers ?? { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const payload = await request.json().catch(() => null);
    if (!payload) {
      return json(
        { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
        400
      );
    }
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!password) {
      return json(
        { ok: false, error: "Missing password", detail: "Password is required.", code: "ADMIN_PASSWORD_MISSING" },
        400
      );
    }
    if (!getAdminPassword(locals)) {
      return json(
        {
          ok: false,
          error: "Missing ADMIN_PASSWORD",
          detail: "Missing ADMIN_PASSWORD in Cloudflare Worker variables/secrets",
          code: "ADMIN_PASSWORD_ENV_MISSING",
        },
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
        { ok: false, error: "Too many attempts. Try again later.", detail: "Rate limit exceeded.", code: "ADMIN_RATE_LIMIT" },
        429,
        headers
      );
    }

    const user = await verifyAdminPassword(locals, password);
    if (!user) {
      await recordAdminLoginFailure(request, locals);
      return json(
        { ok: false, error: "Invalid credentials", detail: "Password mismatch.", code: "ADMIN_PASSWORD_INVALID" },
        401
      );
    }

    await clearAdminLoginFailures(request, locals);
    const session = await createAdminSession(locals, user.id);
    const csrfToken = crypto.randomUUID();
    const secure = isSecureRequest(request);
    const [sessionCookie, csrfCookie] = buildAdminSessionCookies(session.token, csrfToken, secure);
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("set-cookie", sessionCookie);
    headers.append("set-cookie", csrfCookie);
    return json({ ok: true }, 200, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_LOGIN_FAILED" }, 500);
  }
};
