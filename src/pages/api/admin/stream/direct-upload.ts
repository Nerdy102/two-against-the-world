import type { APIRoute } from "astro";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";
import { buildStreamUrls } from "../../../../lib/stream";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const sanitizeMeta = (value: string) =>
  value
    .trim()
    .slice(0, 120)
    .replace(/[^\w\-./ ]/g, "_");

const asNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return json(
      { ok: false, error: "Invalid JSON", detail: "Request body must be valid JSON.", code: "INVALID_JSON" },
      400
    );
  }

  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
  const fileType = typeof payload.fileType === "string" ? payload.fileType.trim().toLowerCase() : "";
  const fileSize = asNumber(payload.fileSize, 0);
  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "untitled";

  if (!fileName) {
    return json(
      { ok: false, error: "Missing file name", detail: "fileName is required.", code: "STREAM_FILE_NAME_MISSING" },
      400
    );
  }
  if (!fileType.startsWith("video/")) {
    return json(
      {
        ok: false,
        error: "Unsupported file type",
        detail: "Only video files are supported for Stream upload.",
        code: "STREAM_FILE_TYPE_INVALID",
      },
      400
    );
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return json(
      { ok: false, error: "Invalid file size", detail: "fileSize must be > 0.", code: "STREAM_FILE_SIZE_INVALID" },
      400
    );
  }

  const env = locals.runtime?.env;
  const accountId = String(env?.CF_ACCOUNT_ID ?? "").trim();
  const streamToken = String(env?.CF_STREAM_TOKEN ?? "").trim();
  if (!accountId || !streamToken) {
    return json(
      {
        ok: false,
        error: "Cloudflare Stream is not configured",
        detail: "Set CF_ACCOUNT_ID and CF_STREAM_TOKEN in Worker environment.",
        code: "STREAM_ENV_MISSING",
      },
      500
    );
  }

  const maxAllowedBytes = asNumber(env?.CF_STREAM_MAX_UPLOAD_BYTES, 50 * 1024 * 1024 * 1024);
  if (fileSize > maxAllowedBytes) {
    return json(
      {
        ok: false,
        error: "File too large",
        detail: `File exceeds configured limit (${maxAllowedBytes} bytes).`,
        code: "STREAM_FILE_TOO_LARGE",
      },
      400
    );
  }

  const maxDurationSeconds = asNumber(env?.CF_STREAM_MAX_DURATION_SECONDS, 36000);
  const requireSignedURLs = String(env?.CF_STREAM_REQUIRE_SIGNED_URLS ?? "false") === "true";

  const upstreamRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${streamToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        maxDurationSeconds,
        requireSignedURLs,
        thumbnailTimestampPct: 0.5,
        meta: {
          fileName: sanitizeMeta(fileName),
          slug: sanitizeMeta(slug || "untitled"),
          source: "twaw-admin",
          createdAt: new Date().toISOString(),
        },
      }),
    }
  );

  const upstream = await upstreamRes.json().catch(() => null);
  if (!upstreamRes.ok || !upstream?.success) {
    return json(
      {
        ok: false,
        error: "Failed to request Cloudflare Stream upload URL",
        detail: upstream?.errors?.[0]?.message ?? "Cloudflare Stream API request failed.",
        code: "STREAM_DIRECT_UPLOAD_CREATE_FAILED",
      },
      502
    );
  }

  const uid = String(upstream?.result?.uid ?? "");
  const uploadURL = String(upstream?.result?.uploadURL ?? "");
  if (!uid || !uploadURL) {
    return json(
      {
        ok: false,
        error: "Invalid Cloudflare Stream response",
        detail: "Missing uid or uploadURL.",
        code: "STREAM_DIRECT_UPLOAD_INVALID_RESPONSE",
      },
      502
    );
  }

  const urls = buildStreamUrls(uid, {
    iframeBase: String(env?.PUBLIC_CF_STREAM_IFRAME_BASE ?? ""),
    deliveryBase: String(env?.PUBLIC_CF_STREAM_DELIVERY_BASE ?? ""),
  });

  return json({
    ok: true,
    uid,
    uploadURL,
    iframe: urls.iframe,
    watch: urls.watch,
    hls: urls.hls,
    thumbnail: urls.thumbnail,
  });
};
