export const STREAM_UID_RE = /^[a-f0-9]{32}$/i;
const VIDEO_PATH_RE = /\.(mp4|m4v|mov|webm|ogv|ogg|m3u8)(?:[?#].*)?$/i;
const STREAM_HOST_RE = /(^|\.)videodelivery\.net$/i;
const STREAM_HOST_ALT_RE = /(^|\.)cloudflarestream\.com$/i;

const normalizeBase = (value: string | undefined, fallback: string) =>
  String(value || fallback).trim().replace(/\/$/, "");

export const normalizeVideoUrl = (value: string | null | undefined) =>
  String(value || "").trim();

const toUrl = (raw: string) => {
  try {
    return new URL(raw);
  } catch {
    if (/^[a-z0-9.-]+\.[a-z]{2,}\/?/i.test(raw)) {
      try {
        return new URL(`https://${raw}`);
      } catch {
        return null;
      }
    }
    return null;
  }
};

const uidFromPath = (pathname: string) => {
  const match = pathname.match(/\/([a-f0-9]{32})(?:[/?#]|$)/i);
  return match?.[1]?.toLowerCase() ?? "";
};

export const extractStreamUid = (value: string | null | undefined) => {
  const raw = normalizeVideoUrl(value);
  if (!raw) return "";
  if (STREAM_UID_RE.test(raw)) return raw.toLowerCase();

  const parsed = toUrl(raw);
  if (!parsed) return "";

  const isStreamHost =
    STREAM_HOST_RE.test(parsed.hostname) || STREAM_HOST_ALT_RE.test(parsed.hostname);
  if (!isStreamHost) return "";

  const fromPath = uidFromPath(parsed.pathname);
  if (fromPath) return fromPath;

  const fromQuery = parsed.searchParams.get("video")?.trim() ?? "";
  if (STREAM_UID_RE.test(fromQuery)) return fromQuery.toLowerCase();
  return "";
};

export const isLikelyVideoUrl = (value: string | null | undefined) => {
  const raw = normalizeVideoUrl(value);
  if (!raw) return false;
  if (extractStreamUid(raw)) return true;
  if (VIDEO_PATH_RE.test(raw)) return true;
  if (raw.startsWith("/videos/")) return true;

  const parsed = toUrl(raw);
  if (!parsed) return false;
  if (VIDEO_PATH_RE.test(parsed.pathname)) return true;
  return /^\/videos\//i.test(parsed.pathname);
};

export const buildStreamUrls = (
  uid: string,
  options?: {
    iframeBase?: string;
    deliveryBase?: string;
  }
) => {
  const streamUid = extractStreamUid(uid);
  if (!streamUid) {
    return {
      uid: "",
      iframe: "",
      watch: "",
      hls: "",
      thumbnail: "",
    };
  }

  const iframeBase = normalizeBase(
    options?.iframeBase,
    "https://iframe.videodelivery.net"
  );
  const deliveryBase = normalizeBase(
    options?.deliveryBase,
    "https://videodelivery.net"
  );

  return {
    uid: streamUid,
    iframe: `${iframeBase}/${streamUid}`,
    watch: `https://watch.videodelivery.net/${streamUid}`,
    hls: `${deliveryBase}/${streamUid}/manifest/video.m3u8`,
    thumbnail: `${deliveryBase}/${streamUid}/thumbnails/thumbnail.jpg`,
  };
};

export const deriveVideoPoster = (
  videoUrl: string | null | undefined,
  options?: {
    deliveryBase?: string;
  }
) => buildStreamUrls(extractStreamUid(videoUrl), {
  deliveryBase: options?.deliveryBase,
}).thumbnail;
