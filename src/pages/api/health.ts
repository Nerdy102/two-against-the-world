import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { getDb } from "../../lib/d1";
import { getPublishedPostsFromContent, shouldUseContentFallback } from "../../lib/posts";

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

const tableExists = async (db: D1Database, table: string) => {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return Boolean(results?.length);
};

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals.runtime?.env ?? {}) as Record<string, unknown>;
  const build = getBuildInfo(env);
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

  return json({
    ok: true,
    workerName: asString(env.WORKER_NAME),
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
  });
};
