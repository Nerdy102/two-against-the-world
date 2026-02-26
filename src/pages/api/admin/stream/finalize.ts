import type { APIRoute } from "astro";
import { requireAdminSession, verifyCsrf } from "../../../../lib/adminAuth";
import { buildStreamUrls, extractStreamUid } from "../../../../lib/stream";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

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

  const uid = extractStreamUid(
    typeof payload.uid === "string" ? payload.uid : ""
  );
  if (!uid) {
    return json(
      {
        ok: false,
        error: "Invalid Stream UID",
        detail: "uid is required and must be a valid Cloudflare Stream video id.",
        code: "STREAM_UID_INVALID",
      },
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

  const upstreamRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${uid}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${streamToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        thumbnailTimestampPct: 0.5,
      }),
    }
  );
  const upstream = await upstreamRes.json().catch(() => null);
  if (!upstreamRes.ok || !upstream?.success) {
    return json(
      {
        ok: false,
        error: "Failed to finalize Cloudflare Stream video",
        detail: upstream?.errors?.[0]?.message ?? "Cloudflare Stream finalize failed.",
        code: "STREAM_FINALIZE_FAILED",
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
    iframe: urls.iframe,
    watch: urls.watch,
    hls: urls.hls,
    thumbnail: urls.thumbnail,
  });
};
