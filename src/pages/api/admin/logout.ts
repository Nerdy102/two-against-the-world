import type { APIRoute } from "astro";
import { clearAdminCookies, clearAdminSession, getAdminSession } from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200, headers?: Headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers,
  });

export const POST: APIRoute = async ({ locals, request }) => {
  const session = await getAdminSession(request, locals);
  if (session?.token) {
    await clearAdminSession(locals, session.token);
  }
  const cookies = clearAdminCookies();
  const headers = new Headers({ "content-type": "application/json" });
  cookies.forEach((cookie) => headers.append("set-cookie", cookie));
  return json({ ok: true }, 200, headers);
};
