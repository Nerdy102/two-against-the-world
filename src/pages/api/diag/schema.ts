import type { APIRoute } from "astro";
import { requireAdminSession } from "../../../lib/adminAuth";
import { getDb } from "../../../lib/d1";

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
    return json({ error: "Unauthorized", code: "ADMIN_UNAUTHORIZED" }, 401);
  }
  if (!locals.runtime?.env?.DB) {
    return json({ error: "Missing DB binding", code: "DB_BINDING_MISSING" }, 500);
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

    return json({ ok: true, tables: tableMap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schema.";
    return json({ error: message, code: "DIAG_SCHEMA_FAILED" }, 500);
  }
};
