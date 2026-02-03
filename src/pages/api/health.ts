import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { getDb } from "../../lib/d1";
import { getPublishedPostsFromContent, shouldUseContentFallback } from "../../lib/posts";
import {
  asString,
  getBuildInfo,
  getDeployTarget,
  getEnvironmentName,
  getRuntimeEnv,
} from "../../lib/runtimeEnv";

export const prerender = false;

const json = (data: unknown, status = 200, headers?: Headers) => {
  const responseHeaders = headers ?? new Headers();
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "application/json");
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
};

const tableExists = async (db: D1Database, table: string) => {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return Boolean(results?.length);
};

export const GET: APIRoute = async ({ locals }) => {
  const env = getRuntimeEnv(locals);
  const build = getBuildInfo(env);
  const deployTarget = getDeployTarget(env);
  const environment = getEnvironmentName(env);
  const workerName = asString(env.WORKER_NAME);
  const warnings: { code: string; detail: string; howToFix: string }[] = [];
  if (workerName && workerName !== "two-against-the-world1") {
    warnings.push({
      code: "WORKER_NAME_MISMATCH",
      detail: `WORKER_NAME is "${workerName}". Production should be two-against-the-world1.`,
      howToFix:
        "Set WORKER_NAME=two-against-the-world1 in vars and deploy to the world1 worker.",
    });
  }
  const schema = {
    posts: false,
    comments: false,
    reactions: false,
    adminUsers: false,
    adminSessions: false,
    commentBans: false,
    adminLoginAttempts: false,
    media: false,
    postMedia: false,
  };
  let d1PublishedCount = 0;
  let d1PublishedSlugs: string[] = [];
  let contentPostCount = 0;
  let mergedCount = 0;
  if (env.DB) {
    try {
      const db = getDb(locals);
      const countRow = await db
        .prepare(`SELECT COUNT(*) as count FROM posts WHERE status = 'published'`)
        .first<{ count: number }>();
      d1PublishedCount = Number(countRow?.count ?? 0);
      const { results } = await db
        .prepare(`SELECT slug FROM posts WHERE status = 'published'`)
        .all<{ slug: string }>();
      d1PublishedSlugs = results?.map((row) => row.slug) ?? [];
      schema.posts = await tableExists(db, "posts");
      schema.comments = await tableExists(db, "comments");
      schema.reactions = await tableExists(db, "reactions");
      schema.adminUsers = await tableExists(db, "admin_users");
      schema.adminSessions = await tableExists(db, "admin_sessions");
      schema.commentBans = await tableExists(db, "comment_bans");
      schema.adminLoginAttempts = await tableExists(db, "admin_login_attempts");
      schema.media = await tableExists(db, "media");
      schema.postMedia = await tableExists(db, "post_media");
    } catch {
      // ignore schema read errors
    }
  }

  try {
    const contentPosts = await getPublishedPostsFromContent();
    contentPostCount = contentPosts.length;
    if (shouldUseContentFallback()) {
      const slugSet = new Set(d1PublishedSlugs);
      contentPosts.forEach((post) => {
        if (post.slug) slugSet.add(post.slug);
      });
      mergedCount = slugSet.size || contentPostCount;
    }
  } catch {
    contentPostCount = 0;
  }
  if (!mergedCount) {
    mergedCount = shouldUseContentFallback() ? contentPostCount : d1PublishedCount;
  }

  if (!env.ADMIN_PASSWORD) {
    warnings.push({
      code: "ADMIN_PASSWORD_MISSING",
      detail: "ADMIN_PASSWORD is not set.",
      howToFix:
        "Cloudflare dashboard → Worker (two-against-the-world1) → Settings → Variables/Secrets → add ADMIN_PASSWORD or run `wrangler secret put ADMIN_PASSWORD --name two-against-the-world1`.",
    });
  }
  if (!env.DB) {
    warnings.push({
      code: "DB_BINDING_MISSING",
      detail: "DB binding is missing.",
      howToFix:
        "Add D1 binding named DB in wrangler.jsonc and Cloudflare dashboard for two-against-the-world1, then redeploy.",
    });
  }
  if (!env.MEDIA) {
    warnings.push({
      code: "R2_BINDING_MISSING",
      detail: "MEDIA (R2) binding is missing.",
      howToFix:
        "Add R2 binding named MEDIA in wrangler.jsonc and Cloudflare dashboard for two-against-the-world1.",
    });
  }
  if (!asString(env.PUBLIC_R2_BASE_URL)) {
    warnings.push({
      code: "PUBLIC_R2_BASE_URL_MISSING",
      detail: "PUBLIC_R2_BASE_URL is not set.",
      howToFix:
        "Set PUBLIC_R2_BASE_URL on two-against-the-world1 (e.g. https://<account>.r2.dev/<bucket>).",
    });
  }
  if (!env.TURNSTILE_SECRET) {
    warnings.push({
      code: "TURNSTILE_SECRET_MISSING",
      detail: "TURNSTILE_SECRET is not set.",
      howToFix:
        "Create a Turnstile site and set TURNSTILE_SECRET in Worker secrets for two-against-the-world1.",
    });
  }
  const missingTables = Object.entries(schema)
    .filter(([, exists]) => !exists)
    .map(([name]) => name);
  if (missingTables.length > 0) {
    warnings.push({
      code: "DB_SCHEMA_MISSING",
      detail: `Missing tables: ${missingTables.join(", ")}`,
      howToFix:
        "Run `npx wrangler d1 migrations apply <DB_NAME> --remote --name two-against-the-world1` (replace <DB_NAME> with the database name in wrangler.jsonc).",
    });
  }

  const headers = new Headers();
  if (build.id || build.sha) {
    headers.set("x-app-build", build.id || build.sha);
  }

  return json({
    ok: true,
    env: {
      hasAdminPassword: Boolean(env.ADMIN_PASSWORD),
      adminPasswordStatus: env.ADMIN_PASSWORD ? "set" : "missing",
      hasDBBinding: Boolean(env.DB),
      hasR2Binding: Boolean(env.MEDIA),
      hasTurnstile: Boolean(env.TURNSTILE_SECRET),
    },
    schema,
    counts: {
      d1PublishedCount,
      contentPostCount,
      mergedCount,
    },
    build,
    workerName,
    deployTarget,
    environment,
    warnings,
  }, 200, headers);
};
