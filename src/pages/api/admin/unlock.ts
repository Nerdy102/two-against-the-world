import type { APIRoute } from "astro";
import {
  buildAdminSessionCookie,
  getAdminPassword,
  getAdminSessionToken,
} from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

export const POST: APIRoute = async ({ locals, request }) => {
  const payload = await request.json().catch(() => null);
  const password = typeof payload?.password === "string" ? payload.password : "";
  const expectedPassword = getAdminPassword(locals);
  if (!expectedPassword) {
    return json({ error: "Missing ADMIN_PASSWORD" }, 500);
  }
  if (!password || password !== expectedPassword) {
    return json({ unlocked: false, error: "Invalid password" }, 401);
  }
  const token = await getAdminSessionToken(locals);
  if (!token) {
    return json({ error: "Missing session token" }, 500);
  }
  const secure = request.url.startsWith("https://");
  const cookie = buildAdminSessionCookie(token, { secure });
  return json({ unlocked: true }, 200, { "set-cookie": cookie });
};
