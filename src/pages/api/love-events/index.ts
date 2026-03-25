import type { APIRoute } from "astro";
import { ensureLoveEventsSchema, getDb, type LoveEventRecord } from "../../../lib/d1";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const normalizeEventName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();

const buildEventSignature = (event: LoveEventRecord) =>
  [
    event.event_group || "extra",
    normalizeEventName(event.name || ""),
    Number(event.year || 0),
    Number(event.month || 0),
    Number(event.day || 0),
    Number(event.hour || 0),
    Number(event.minute || 0),
  ].join("|");

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDb(locals);
    await ensureLoveEventsSchema(db, { allowBootstrap: true });
    const { results } = await db
      .prepare(
        `SELECT
           id,
           name,
           year,
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
    const seen = new Set<string>();
    const dedupedEvents = (results ?? []).filter((event) => {
      const signature = buildEventSignature(event);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
    return json({ ok: true, events: dedupedEvents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch love events.";
    return json({ ok: false, error: message, detail: message, code: "LOVE_EVENTS_FETCH_FAILED" }, 500);
  }
};
