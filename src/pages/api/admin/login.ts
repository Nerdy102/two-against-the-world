import type { APIRoute } from "astro";
import {
  buildAdminSessionCookies,
  createAdminSession,
  verifyAdminLogin,
} from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200, headers?: Headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers,
  });

export const POST: APIRoute = async ({ locals, request }) => {
  const payload = await request.json().catch(() => null);
  if (!payload) return json({ error: "Invalid JSON" }, 400);
  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!username || !password) {
    return json({ error: "Missing credentials" }, 400);
  }

  const user = await verifyAdminLogin(locals, username, password);
  if (!user) {
    return json({ error: "Invalid credentials" }, 401);
  }

  const session = await createAdminSession(locals, user.id);
  const csrfToken = crypto.randomUUID();
  const secure = request.url.startsWith("https://");
  const [sessionCookie, csrfCookie] = buildAdminSessionCookies(session.token, csrfToken, secure);
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", sessionCookie);
  headers.append("set-cookie", csrfCookie);
  return json({ ok: true }, 200, headers);
};
