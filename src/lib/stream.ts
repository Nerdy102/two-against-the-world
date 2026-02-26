export const STREAM_UID_RE = /^[a-f0-9]{32}$/i;

const normalizeBase = (value: string | undefined, fallback: string) =>
  String(value || fallback).trim().replace(/\/$/, "");

export const extractStreamUid = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (STREAM_UID_RE.test(raw)) return raw.toLowerCase();

  const pathMatch = raw.match(/\/([a-f0-9]{32})(?:[/?#]|$)/i);
  if (pathMatch?.[1]) return pathMatch[1].toLowerCase();

  const fallback = raw.match(/\b([a-f0-9]{32})\b/i);
  return fallback?.[1]?.toLowerCase() ?? "";
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
