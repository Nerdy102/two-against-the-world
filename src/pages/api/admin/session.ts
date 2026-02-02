import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const GET: APIRoute = async ({ locals, request }) => {
  const unlocked = await isAdminAuthorized(request, locals);
  return json({ unlocked });
};
