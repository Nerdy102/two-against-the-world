import type { APIRoute } from "astro";
import { ensureLoveEventsSchema, getDb, type LoveEventRecord } from "../../../lib/d1";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDb(locals);
    await ensureLoveEventsSchema(db, { allowBootstrap: true });
    const { results } = await db
      .prepare(
        `SELECT
           id,
           name,
           month,
           day,
           hour,
           minute,
           event_group,
           icon,
           note,
           accent_rgb,
           is_active,
           created_at,
           updated_at
         FROM love_events
         WHERE is_active = 1
         ORDER BY datetime(created_at) DESC`
      )
      .all<LoveEventRecord>();
    return json({ ok: true, events: results ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch love events.";
    return json({ ok: false, error: message, detail: message, code: "LOVE_EVENTS_FETCH_FAILED" }, 500);
  }
};
