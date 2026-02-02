import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/server/auth";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

function nowPath(date = new Date()): { yyyy: string; mm: string } {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return { yyyy, mm };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;

  let session;
  try {
    session = await requireAdmin(request, env);
  } catch (resp) {
    return resp as Response;
  }

  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength && contentLength > MAX_BYTES) {
    return json({ error: "file_too_large" }, { status: 413 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "image").slice(0, 20);

  if (!(file instanceof File)) {
    return json({ error: "missing_file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return json({ error: "file_too_large" }, { status: 413 });
  }

  const mime = file.type || "application/octet-stream";
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    return json({ error: "unsupported_type", mime }, { status: 400 });
  }

  const { yyyy, mm } = nowPath();
  const id = crypto.randomUUID();
  const prefix = kind === "audio" ? "audio" : "images";
  const key = `${prefix}/${yyyy}/${mm}/${id}.${ext}`;

  await env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: mime,
    },
  });

  await env.DB
    .prepare("INSERT INTO uploads (id, key, mime, size, created_at, uploader) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, key, mime, file.size, Date.now(), session.author ?? null)
    .run();

  return json({
    ok: true,
    upload: {
      id,
      key,
      url: `/media/${key}`,
      mime,
      size: file.size,
    },
  });
};
