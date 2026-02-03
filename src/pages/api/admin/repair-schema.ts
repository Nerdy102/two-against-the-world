import type { APIRoute } from "astro";
import {
  ensureAdminSchema,
  ensureCommentsSchema,
  ensureMediaSchema,
  ensurePostMediaSchema,
  ensurePostsSchema,
  ensureReactionsSchema,
  getDb,
} from "../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const TABLES = [
  "posts",
  "comments",
  "reactions",
  "admin_users",
  "admin_sessions",
  "comment_bans",
  "admin_login_attempts",
  "media",
  "post_media",
];

const getTableInfo = async (db: ReturnType<typeof getDb>, table: string) => {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return results?.map((row) => row.name) ?? [];
};

const getSqliteMaster = async (db: ReturnType<typeof getDb>) => {
  const { results } = await db
    .prepare(`SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','index')`)
    .all<{ name: string; type: string; sql: string }>();
  return results ?? [];
};

const snapshotSchema = async (db: ReturnType<typeof getDb>) => {
  const tables: Record<string, string[]> = {};
  for (const table of TABLES) {
    tables[table] = await getTableInfo(db, table);
  }
  const sqliteMaster = await getSqliteMaster(db);
  return { tables, sqliteMaster };
};

export const POST: APIRoute = async ({ request, locals }) => {
  const adminUserId = await requireAdminSession(request, locals);
  if (!adminUserId) {
    return json(
      { ok: false, error: "Unauthorized", detail: "Admin session required.", code: "ADMIN_UNAUTHORIZED" },
      401
    );
  }
  if (!verifyCsrf(request)) {
    return json(
      { ok: false, error: "Invalid CSRF", detail: "CSRF token mismatch.", code: "CSRF_INVALID" },
      403
    );
  }

  const db = getDb(locals);
  const before = await snapshotSchema(db);
  await ensurePostsSchema(db, { allowBootstrap: true });
  await ensureCommentsSchema(db, { allowBootstrap: true });
  await ensureReactionsSchema(db, { allowBootstrap: true });
  await ensureMediaSchema(db, { allowBootstrap: true });
  await ensurePostMediaSchema(db, { allowBootstrap: true });
  await ensureAdminSchema(db, { allowBootstrap: true });
  const after = await snapshotSchema(db);

  return json({
    ok: true,
    repaired: true,
    before,
    after,
  });
};
