import type { D1Database } from "@cloudflare/workers-types";

const IMAGE_MARKDOWN_RE = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const MEDIA_ABSOLUTE_URL_RE = /^https?:\/\/[^/]+\/media\/(.+)$/i;
const R2_KEY_FROM_URL_RE = /^https?:\/\/[^/]+\/(.+)$/i;

const normalizeUrl = (value: string): string | null => {
  const trimmed = value.trim().replace(/^<|>$/g, "");
  if (!trimmed) return null;
  const mediaMatch = trimmed.match(MEDIA_ABSOLUTE_URL_RE);
  if (mediaMatch?.[1]) return `/media/${mediaMatch[1]}`;
  return trimmed;
};

const extractMediaKey = (url: string): string => {
  const cleanUrl = url.split(/[?#]/)[0] ?? url;
  if (cleanUrl.startsWith("/media/")) {
    return decodeURIComponent(cleanUrl.slice("/media/".length));
  }
  const mediaMatch = cleanUrl.match(MEDIA_ABSOLUTE_URL_RE);
  if (mediaMatch?.[1]) return decodeURIComponent(mediaMatch[1]);
  const absoluteMatch = cleanUrl.match(R2_KEY_FROM_URL_RE);
  if (absoluteMatch?.[1]) return decodeURIComponent(absoluteMatch[1]);
  return cleanUrl;
};

const extractImageUrlsFromMarkdown = (markdown: string | null | undefined): string[] => {
  if (!markdown) return [];
  IMAGE_MARKDOWN_RE.lastIndex = 0;
  const urls: string[] = [];
  for (;;) {
    const match = IMAGE_MARKDOWN_RE.exec(markdown);
    if (!match) break;
    const normalized = normalizeUrl(match[1] ?? "");
    if (!normalized || urls.includes(normalized)) continue;
    urls.push(normalized);
  }
  return urls;
};

export const buildOrderedPostMediaUrls = ({
  coverUrl,
  bodyMarkdown,
  contentMarkdown,
}: {
  coverUrl: string | null | undefined;
  bodyMarkdown: string | null | undefined;
  contentMarkdown: string | null | undefined;
}): string[] => {
  const ordered: string[] = [];
  const add = (value: string | null | undefined) => {
    if (!value) return;
    if (ordered.includes(value)) return;
    ordered.push(value);
  };

  add(normalizeUrl(coverUrl ?? ""));
  for (const url of extractImageUrlsFromMarkdown(bodyMarkdown)) add(url);
  for (const url of extractImageUrlsFromMarkdown(contentMarkdown)) add(url);
  return ordered;
};

type PostMediaRow = {
  id: string;
  url: string;
  r2_key: string;
};

export const syncPostMediaOrder = async ({
  db,
  postId,
  orderedUrls,
}: {
  db: D1Database;
  postId: string;
  orderedUrls: string[];
}) => {
  const uniqueUrls = orderedUrls.filter(Boolean);
  const existingRows = await db
    .prepare(
      `SELECT id, url, r2_key
       FROM post_media
       WHERE post_id = ?`
    )
    .bind(postId)
    .all<PostMediaRow>();
  const existing = existingRows.results ?? [];
  const existingByUrl = new Map<string, PostMediaRow>();
  for (const row of existing) {
    existingByUrl.set(row.url, row);
  }

  const keepIds = new Set<string>();
  for (const [index, url] of uniqueUrls.entries()) {
    const sortOrder = index;
    const current = existingByUrl.get(url);
    if (current) {
      keepIds.add(current.id);
      await db
        .prepare(
          `UPDATE post_media
           SET sort_order = ?
           WHERE id = ?`
        )
        .bind(sortOrder, current.id)
        .run();
      continue;
    }
    const r2Key = extractMediaKey(url);
    await db
      .prepare(
        `INSERT INTO post_media (id, post_id, r2_key, url, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), postId, r2Key, url, sortOrder)
      .run();
  }

  for (const row of existing) {
    if (keepIds.has(row.id)) continue;
    await db.prepare(`DELETE FROM post_media WHERE id = ?`).bind(row.id).run();
  }
};
