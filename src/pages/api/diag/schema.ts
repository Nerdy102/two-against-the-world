import type { APIRoute } from "astro";
import { requireAdminSession } from "../../../lib/adminAuth";
import { getDb } from "../../../lib/d1";
import { getRuntimeEnv } from "../../../lib/runtimeEnv";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const extractChecks = (sql: string | null) => {
  if (!sql) return [];
  const matches = sql.matchAll(/CHECK\s*\(([^)]+)\)/gi);
  return Array.from(matches, (match) => match[1].trim());
};

export const GET: APIRoute = async ({ locals, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json(
      { error: "Unauthorized", detail: "Admin session required.", code: "ADMIN_UNAUTHORIZED" },
      401
    );
  }
  const env = getRuntimeEnv(locals);
  if (!env.DB) {
    return json(
      {
        error: "Missing DB binding",
        detail: "DB binding is required.",
        code: "DB_BINDING_MISSING",
        howToFix:
          "Add D1 binding named DB in wrangler.jsonc and Cloudflare dashboard for two-against-the-world1, then redeploy.",
      },
      500
    );
  }
  try {
    const db = getDb(locals);
    const tables = ["posts", "post_media", "comments", "reactions", "admin_sessions"];
    const placeholders = tables.map(() => "?").join(", ");
    const { results } = await db
      .prepare(
        `SELECT name, sql
         FROM sqlite_schema
         WHERE type = 'table' AND name IN (${placeholders})`
      )
      .bind(...tables)
      .all<{ name: string; sql: string | null }>();

    const tableMap = tables.reduce<Record<string, { sql: string | null; checks: string[] }>>(
      (acc, name) => {
        acc[name] = { sql: null, checks: [] };
        return acc;
      },
      {}
    );

    for (const row of results ?? []) {
      tableMap[row.name] = { sql: row.sql ?? null, checks: extractChecks(row.sql ?? null) };
    }

    const missingTables = tables.filter((table) => !tableMap[table]?.sql);

    return json({
      ok: true,
      tables: tableMap,
      missingTables,
      howToFix:
        missingTables.length > 0
          ? {
              listMigrations: "npx wrangler d1 migrations list <DB_NAME> --name two-against-the-world1",
              applyMigrations: "npx wrangler d1 migrations apply <DB_NAME> --remote --name two-against-the-world1",
              note: "Replace <DB_NAME> with the database name in wrangler.jsonc.",
            }
          : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schema.";
    return json({ error: message, detail: message, code: "DIAG_SCHEMA_FAILED" }, 500);
  }
};
