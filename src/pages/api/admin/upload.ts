import type { APIRoute } from "astro";
import { getDb } from "../../../lib/d1";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const buildKey = (slug: string, filename: string) => {
  const safeSlug = slug || "untitled";
  const date = new Date().toISOString().slice(0, 10);
  return `web/${date}/${safeSlug}/${filename}`;
};

export const POST: APIRoute = async ({ locals, request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "Invalid form data" }, 400);

  const file = form.get("file");
  const slug = typeof form.get("slug") === "string" ? String(form.get("slug")) : "untitled";
  const meta = typeof form.get("meta") === "string" ? String(form.get("meta")) : null;

  if (!(file instanceof File)) {
    return json({ error: "Missing file" }, 400);
  }

  const filename = file.name || `upload-${Date.now()}.jpg`;
  const key = buildKey(slug, filename);
  const contentType = file.type || "image/jpeg";
  const bucket = locals.runtime?.env?.MEDIA;
  if (!bucket) {
    return json({ error: "Missing MEDIA binding" }, 500);
  }

  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType },
  });

  const baseUrl = locals.runtime?.env?.PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
  const url = baseUrl ? `${baseUrl}/${key}` : key;

  const db = getDb(locals);
  await db
    .prepare(
      `INSERT INTO media (id, url, type, meta_json, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), url, "image", meta, "admin")
    .run();

  return json({ ok: true, url, key });
};
