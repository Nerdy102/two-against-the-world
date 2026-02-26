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

const parseIntOrNull = (value: unknown, min: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return null;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const hasOwn = (payload: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(payload, key);

const selectByIdSql = `SELECT
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
WHERE id = ?
LIMIT 1`;

const requireAuthorized = async (request: Request, locals: App.Locals) => {
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
  return null;
};

export const POST: APIRoute = async ({ locals, request }) => {
  const unauthorized = await requireAuthorized(request, locals);
  if (unauthorized) return unauthorized;
  try {
    const payload = await request.json().catch(() => null);
    if (!isRecord(payload)) {
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
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    if (!note) {
      return json(
        {
          ok: false,
          error: "Missing description",
          detail: "Event description is required.",
          code: "LOVE_EVENT_NOTE_MISSING",
        },
        400
      );
    }

    const month = clampInt(payload.month, 1, 12, 1);
    const day = clampInt(payload.day, 1, 31, 1);
    const hour = clampInt(payload.hour, 0, 23, 0);
    const minute = clampInt(payload.minute, 0, 59, 0);
    const eventGroup = payload.event_group === "featured" ? "featured" : "extra";
    const icon = typeof payload.icon === "string" ? payload.icon.trim().slice(0, 4) : "";
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

export const PATCH: APIRoute = async ({ locals, request }) => {
  const unauthorized = await requireAuthorized(request, locals);
  if (unauthorized) return unauthorized;
  try {
    const payload = await request.json().catch(() => null);
    if (!isRecord(payload)) {
      return json(
        { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
        400
      );
    }

    const id = typeof payload.id === "string" ? payload.id.trim() : "";
    if (!id) {
      return json(
        { ok: false, error: "Missing id", detail: "Event id is required.", code: "LOVE_EVENT_ID_MISSING" },
        400
      );
    }

    const db = getDb(locals);
    await ensureLoveEventsSchema(db, { allowBootstrap: true });
    const existing = await db.prepare(selectByIdSql).bind(id).first<LoveEventRecord>();
    const updatedAt = new Date().toISOString();

    if (!existing) {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!name) {
        return json(
          { ok: false, error: "Missing name", detail: "Event name is required.", code: "LOVE_EVENT_NAME_MISSING" },
          400
        );
      }
      const month = parseIntOrNull(payload.month, 1, 12);
      const day = parseIntOrNull(payload.day, 1, 31);
      if (month === null || day === null) {
        return json(
          {
            ok: false,
            error: "Missing date",
            detail: "Event month/day is required for new records.",
            code: "LOVE_EVENT_DATE_MISSING",
          },
          400
        );
      }
      const note = typeof payload.note === "string" ? payload.note.trim() : "";
      if (!note) {
        return json(
          {
            ok: false,
            error: "Missing description",
            detail: "Event description is required.",
            code: "LOVE_EVENT_NOTE_MISSING",
          },
          400
        );
      }

      const hour = clampInt(payload.hour, 0, 23, 0);
      const minute = clampInt(payload.minute, 0, 59, 0);
      const eventGroup = payload.event_group === "featured" ? "featured" : "extra";
      const icon = typeof payload.icon === "string" ? payload.icon.trim().slice(0, 4) : "";
      const accentRgb = normalizeAccent(payload.accent_rgb);

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
          note,
          accentRgb,
          updatedAt,
          updatedAt
        )
        .run();

      const created = await db.prepare(selectByIdSql).bind(id).first<LoveEventRecord>();
      if (!created) {
        return json(
          { ok: false, error: "Failed to create event.", detail: "Insert succeeded but no row returned.", code: "LOVE_EVENT_CREATE_FAILED" },
          500
        );
      }
      return json({ ok: true, event: created }, 201);
    }

    const nextNameRaw = typeof payload.name === "string" ? payload.name.trim() : existing.name;
    if (!nextNameRaw) {
      return json(
        { ok: false, error: "Missing name", detail: "Event name is required.", code: "LOVE_EVENT_NAME_MISSING" },
        400
      );
    }

    const nextMonth = parseIntOrNull(payload.month, 1, 12) ?? existing.month;
    const nextDay = parseIntOrNull(payload.day, 1, 31) ?? existing.day;
    const nextHour = parseIntOrNull(payload.hour, 0, 23) ?? existing.hour;
    const nextMinute = parseIntOrNull(payload.minute, 0, 59) ?? existing.minute;
    const nextGroup =
      payload.event_group === "featured" || payload.event_group === "extra"
        ? payload.event_group
        : existing.event_group;
    const nextIcon =
      typeof payload.icon === "string" ? payload.icon.trim().slice(0, 4) || null : existing.icon;
    const nextNote =
      typeof payload.note === "string" ? payload.note.trim() : (existing.note ?? "");
    if (!nextNote) {
      return json(
        {
          ok: false,
          error: "Missing description",
          detail: "Event description is required.",
          code: "LOVE_EVENT_NOTE_MISSING",
        },
        400
      );
    }
    const nextAccent = hasOwn(payload, "accent_rgb")
      ? normalizeAccent(payload.accent_rgb)
      : existing.accent_rgb;

    await db
      .prepare(
        `UPDATE love_events
         SET name = ?,
             month = ?,
             day = ?,
             hour = ?,
             minute = ?,
             event_group = ?,
             icon = ?,
             note = ?,
             accent_rgb = ?,
             is_active = 1,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        nextNameRaw,
        nextMonth,
        nextDay,
        nextHour,
        nextMinute,
        nextGroup,
        nextIcon,
        nextNote,
        nextAccent,
        updatedAt,
        id
      )
      .run();

    const updated = await db.prepare(selectByIdSql).bind(id).first<LoveEventRecord>();
    if (!updated) {
      return json(
        { ok: false, error: "Failed to update event.", detail: "No record returned after update.", code: "LOVE_EVENT_UPDATE_FAILED" },
        500
      );
    }
    return json({ ok: true, event: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update event.";
    return json({ ok: false, error: message, detail: message, code: "ADMIN_LOVE_EVENT_UPDATE_FAILED" }, 500);
  }
};
