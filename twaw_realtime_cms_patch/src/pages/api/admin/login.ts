import type { APIRoute } from "astro";
import { adminCookie, signAdminSession, verifyAdminPassword } from "../../../lib/server/auth";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const password = String(body?.password || "");
  const author = String(body?.author || "").trim().slice(0, 40) || null;

  const ok = await verifyAdminPassword(password, env);
  if (!ok) return json({ error: "invalid_password" }, { status: 403 });

  const now = Date.now();
  const maxAgeSeconds = 60 * 60 * 24 * 14; // 14 days

  const token = await signAdminSession(
    {
      sub: "admin",
      author: author ?? undefined,
      exp: now + maxAgeSeconds * 1000,
    },
    env
  );

  return json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": adminCookie(token, maxAgeSeconds),
      },
    }
  );
};
