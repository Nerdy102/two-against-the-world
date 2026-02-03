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

const json = (data: unknown, status = 200, headers?: Headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers,
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const payload = await request.json().catch(() => null);
    if (!payload) return json({ error: "Invalid JSON" }, 400);

    const password = typeof payload.password === "string" ? payload.password : "";

    if (!password) {
      return json({ error: "Missing password" }, 400);
    }
    const adminPassword = getAdminPassword(locals);
    if (!adminPassword) {
      return json(
        { error: "Missing ADMIN_PASSWORD (set it in .dev.vars for wrangler dev)" },
        400
      );
    }
    if (!locals.runtime?.env?.DB) {
      return json({ error: "Missing DB binding in local runtime" }, 500);
    }

    const rateLimit = await checkAdminLoginRateLimit(request, locals);
    if (!rateLimit.allowed) {
      const headers = new Headers({ "content-type": "application/json" });
      if (rateLimit.retryAfter) {
        headers.set("retry-after", String(rateLimit.retryAfter));
      }
      return json({ error: "Too many attempts. Try again later." }, 429, headers);
    }

    const user = await verifyAdminPassword(locals, password);
    if (!user) {
      await recordAdminLoginFailure(request, locals);
      return json({ error: "Invalid credentials" }, 401);
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
      return json({ error: "Missing DB binding in local runtime" }, 500);
    }
    if (message.startsWith('D1 schema missing for "')) {
      return json({ error: "Missing DB schema; apply migrations locally" }, 500);
    }
    return json({ error: message }, 500);
  }
};
