import type { APIRoute } from "astro";
import { getAdminSession } from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const GET: APIRoute = async ({ locals, request }) => {
  const session = await getAdminSession(request, locals);
  return json({ authenticated: Boolean(session) });
};
