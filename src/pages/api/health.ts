import type { APIRoute } from "astro";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const getBuildInfo = (env: Record<string, unknown>) => {
  const sha =
    asString(env.BUILD_SHA) ||
    asString(env.PUBLIC_BUILD_SHA) ||
    asString(env.CF_PAGES_COMMIT_SHA) ||
    asString(env.GITHUB_SHA);
  const time =
    asString(env.BUILD_TIME) ||
    asString(env.PUBLIC_BUILD_TIME) ||
    asString(env.CF_PAGES_BUILD_TIMESTAMP);
  return { sha, time };
};

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env ?? {};
  const build = getBuildInfo(env);
  return json({
    ok: true,
    env: {
      hasAdminPassword: Boolean(env.ADMIN_PASSWORD),
      hasDb: Boolean(env.DB),
      hasR2: Boolean(env.MEDIA),
      hasTurnstile: Boolean(env.TURNSTILE_SECRET),
    },
    build,
  });
};
