import type { APIRoute } from "astro";
import { clearAdminCookie } from "../../../lib/server/auth";

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearAdminCookie(),
    },
  });
};
