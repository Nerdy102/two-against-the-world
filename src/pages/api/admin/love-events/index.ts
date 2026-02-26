import type { APIRoute } from "astro";
import { ensureLoveEventsSchema, getDb, type LoveEventRecord } from "../../../../lib/d1";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const clampInt = (value: unknown, min: number, max: number, fallback = min) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const normalizeAccent = (value: unknown) => {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .replace(/[^0-9\s]/g, " ")
    .replace(/\s+/g, " ");
  if (!cleaned) return null;
  const parts = cleaned.split(" ").map((item) => clampInt(item, 0, 255, 0));
  if (parts.length < 3) return null;
  return `${parts[0]} ${parts[1]} ${parts[2]}`;
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!(await requireAdminSession(request, locals))) {
    return json(
      { ok: false, error: "Unauthorized", detail: "Admin session required.", code: "ADMIN_UNAUTHORIZED" },
      401
    );
  }
  if (!verifyCsrf(request)) {
    return json(
      { ok: false, error: "Unauthorized", detail: "CSRF validation failed.", code: "ADMIN_CSRF_INVALID" },
      401
    );
  }
  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json(
        { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
        400
      );
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return json(
        { ok: false, error: "Missing name", detail: "Event name is required.", code: "LOVE_EVENT_NAME_MISSING" },
        400
      );
    }

    const month = clampInt(payload.month, 1, 12, 1);
    const day = clampInt(payload.day, 1, 31, 1);
    const hour = clampInt(payload.hour, 0, 23, 0);
    const minute = clampInt(payload.minute, 0, 59, 0);
    const eventGroup = payload.event_group === "featured" ? "featured" : "extra";
    const icon = typeof payload.icon === "string" ? payload.icon.trim().slice(0, 4) : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    const accentRgb = normalizeAccent(payload.accent_rgb);

    const db = getDb(locals);
    await ensureLoveEventsSchema(db, { allowBootstrap: true });
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO love_events (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        id,
        name,
        month,
        day,
        hour,
        minute,
        eventGroup,
        icon || null,
        note || null,
        accentRgb,
        createdAt,
        createdAt
      )
      .run();

    const createdEvent: LoveEventRecord = {
      id,
      name,
      month,
      day,
      hour,
      minute,
      event_group: eventGroup,
      icon: icon || null,
      note: note || null,
      accent_rgb: accentRgb,
      is_active: 1,
      created_at: createdAt,
      updated_at: createdAt,
    };

    return json({ ok: true, event: createdEvent }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create event.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_LOVE_EVENT_CREATE_FAILED" }, 500);
  }
};
