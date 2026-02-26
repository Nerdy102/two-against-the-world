import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { resolveTopicSlug } from "../config/topics";
import type { PostRecord } from "./d1";
import { deriveVideoPoster, isLikelyVideoUrl, normalizeVideoUrl } from "./stream";
import { comparePostsByNewest } from "./postTime";

export const DEFAULT_POST_CARD_IMAGE = "/collage/moodboard.jpg";

const toIsoString = (value: Date | string | undefined | null) => {
  if (!value) return new Date().toISOString();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const normalizeIsoDateTime = (value: string | undefined | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toMediaTimeZone = (value: string | undefined | null) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const toContentPublishedAt = (entry: CollectionEntry<"posts">) => {
  const postedAt = normalizeIsoDateTime(entry.data.postedAt ?? undefined);
  if (postedAt) return postedAt;
  return toIsoString(entry.data.pubDate);
};

const IMAGE_MARKDOWN_RE = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const MEDIA_ABSOLUTE_URL_RE = /^https?:\/\/[^/]+\/media\/(.+)$/i;

const normalizeMediaUrl = (value: string): string => {
  const match = value.match(MEDIA_ABSOLUTE_URL_RE);
  if (!match?.[1]) return value;
  return `/media/${match[1]}`;
};

const normalizeImageUrl = (value: string): string | null => {
  const trimmed = value.trim().replace(/^<|>$/g, "");
  if (!trimmed) return null;
  return normalizeMediaUrl(trimmed);
};

export const extractFirstImageUrl = (markdown: string | null | undefined): string | null => {
  if (!markdown) return null;
  IMAGE_MARKDOWN_RE.lastIndex = 0;
  const match = IMAGE_MARKDOWN_RE.exec(markdown);
  const raw = match?.[1];
  return raw ? normalizeImageUrl(raw) : null;
};

const nonEmpty = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = normalizeMediaUrl(value.trim());
  if (trimmed === "/noise.svg") return null;
  return trimmed ? trimmed : null;
};

const SUMMARY_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s)]+/i;
const SUMMARY_ORPHAN_LINK_LABEL_RE = /\blink\b/i;

const pickBetterSummary = (
  dbSummary: string | null | undefined,
  contentSummary: string | null | undefined
): string | null => {
  const dbValue = typeof dbSummary === "string" ? dbSummary.trim() : "";
  const contentValue = typeof contentSummary === "string" ? contentSummary.trim() : "";
  if (!contentValue) return dbValue || null;
  if (!dbValue) return contentValue;
  if (SUMMARY_LINK_RE.test(dbValue)) return dbValue;
  if (SUMMARY_LINK_RE.test(contentValue) && SUMMARY_ORPHAN_LINK_LABEL_RE.test(dbValue)) {
    return contentValue;
  }
  return dbValue;
};

const needsSummaryRescue = (summary: string | null | undefined) => {
  const value = typeof summary === "string" ? summary.trim() : "";
  if (!value) return false;
  return !SUMMARY_LINK_RE.test(value) && SUMMARY_ORPHAN_LINK_LABEL_RE.test(value);
};

export const resolvePostCoverUrl = (
  post: Pick<PostRecord, "cover_url" | "body_markdown" | "content_md" | "video_url" | "video_poster">
): string => {
  const normalizedVideoUrl = normalizeVideoUrl(post.video_url);
  const hasVideo = isLikelyVideoUrl(normalizedVideoUrl);
  const videoPoster = hasVideo
    ? nonEmpty(post.video_poster) || deriveVideoPoster(normalizedVideoUrl)
    : null;
  if (videoPoster) return videoPoster;

  const directCover = nonEmpty(post.cover_url);
  if (directCover) return directCover;

  const bodyImage = extractFirstImageUrl(post.body_markdown);
  if (bodyImage) return bodyImage;

  const contentImage = extractFirstImageUrl(post.content_md);
  if (contentImage) return contentImage;

  return DEFAULT_POST_CARD_IMAGE;
};

export const mapContentEntryToPostRecord = (
  entry: CollectionEntry<"posts">
): PostRecord => {
  const publishedAt = toContentPublishedAt(entry);
  const publishedTz = toMediaTimeZone(entry.data.postedTimezone ?? undefined);
  const body = entry.body || null;
  const normalizedVideoUrl = normalizeVideoUrl(entry.data.videoUrl ?? null);
  const hasVideo = isLikelyVideoUrl(normalizedVideoUrl);
  const resolvedVideoPoster = hasVideo
    ? entry.data.videoPoster || deriveVideoPoster(normalizedVideoUrl) || null
    : null;
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.data.title,
    summary: entry.data.description || null,
    content_md: body,
    body_markdown: body,
    cover_url: (hasVideo ? resolvedVideoPoster : null) || entry.data.cover || extractFirstImageUrl(body),
    status: entry.data.draft ? "draft" : "published",
    author_name: entry.data.author || null,
    topic: resolveTopicSlug(entry.data.topic),
    location: entry.data.location || null,
    event_time: entry.data.eventTime || null,
    written_at: entry.data.writtenAt || null,
    photo_time: entry.data.photoTime || null,
    tags_csv: entry.data.tags?.length ? entry.data.tags.join(", ") : null,
    side_note: entry.data.sideNote || null,
    voice_memo: entry.data.voiceMemo || null,
    voice_memo_title: entry.data.voiceMemoTitle || null,
    video_url: hasVideo ? normalizedVideoUrl : null,
    video_poster: resolvedVideoPoster,
    photo_dir: entry.data.photoDir || null,
    photo_count: entry.data.photoCount ?? 0,
    pinned: entry.data.pinned ? 1 : 0,
    pinned_priority: entry.data.pinnedPriority ?? 0,
    pinned_until: entry.data.pinnedUntil ? String(entry.data.pinnedUntil) : null,
    pinned_style: entry.data.pinnedStyle ? String(entry.data.pinnedStyle) : null,
    layout: "normal",
    sort_order: 0,
    published_at: publishedAt,
    published_tz: publishedTz,
    created_at: publishedAt,
    updated_at: publishedAt,
  };
};

const withNormalizedPostFields = (post: PostRecord): PostRecord => {
  const normalizedVideoUrl = normalizeVideoUrl(post.video_url);
  const hasVideo = isLikelyVideoUrl(normalizedVideoUrl);
  const normalized: PostRecord = {
    ...post,
    topic: resolveTopicSlug(post.topic),
    video_url: hasVideo ? normalizedVideoUrl : null,
    video_poster: hasVideo ? post.video_poster ?? null : null,
  };
  return {
    ...normalized,
    cover_url: resolvePostCoverUrl(normalized),
  };
};

export const getPublishedPostsFromContent = async (): Promise<PostRecord[]> => {
  const entries = await getCollection("posts");
  return entries
    .filter((entry) => !entry.data.draft)
    .map(mapContentEntryToPostRecord)
    .sort(comparePosts);
};

export const getPostFromContentBySlug = async (
  slug: string
): Promise<PostRecord | null> => {
  const entries = await getCollection("posts");
  const entry = entries.find((item) => item.slug === slug || item.id === slug);
  if (!entry || entry.data.draft) return null;
  return mapContentEntryToPostRecord(entry);
};

const isPinnedActive = (post: PostRecord) => {
  if (Number(post.pinned ?? 0) !== 1) return false;
  if (!post.pinned_until) return true;
  const until = new Date(post.pinned_until);
  if (Number.isNaN(until.getTime())) return true;
  return until.getTime() > Date.now();
};

const comparePosts = (a: PostRecord, b: PostRecord) => {
  const pinnedA = isPinnedActive(a) ? 1 : 0;
  const pinnedB = isPinnedActive(b) ? 1 : 0;
  if (pinnedB !== pinnedA) {
    return pinnedB - pinnedA;
  }
  const priorityA = Number(a.pinned_priority ?? 0);
  const priorityB = Number(b.pinned_priority ?? 0);
  if (priorityB !== priorityA) {
    return priorityB - priorityA;
  }
  return comparePostsByNewest(a, b);
};

export const shouldUseContentFallback = () =>
  import.meta.env.PUBLIC_ENABLE_CONTENT_FALLBACK !== "false";

export const mergePostsBySlug = (
  dbPosts: PostRecord[],
  contentPosts: PostRecord[]
): PostRecord[] => {
  const contentBySlug = new Map(
    contentPosts
      .filter((post) => Boolean(post?.slug))
      .map((post) => [post.slug, post] as const)
  );
  const map = new Map<string, PostRecord>();
  for (const post of dbPosts) {
    if (!post?.slug) continue;
    const summary = pickBetterSummary(post.summary, contentBySlug.get(post.slug)?.summary);
    map.set(
      post.slug,
      withNormalizedPostFields({
        ...post,
        summary,
      })
    );
  }
  for (const post of contentPosts) {
    if (!post?.slug || map.has(post.slug)) continue;
    map.set(post.slug, withNormalizedPostFields(post));
  }
  return Array.from(map.values()).sort(comparePosts);
};

export const getHybridPostBySlug = async (
  dbPost: PostRecord | null,
  slug: string
): Promise<PostRecord | null> => {
  const allowContentFallback = shouldUseContentFallback();
  const shouldRescueDbSummary = needsSummaryRescue(dbPost?.summary);
  if (!allowContentFallback && !shouldRescueDbSummary) {
    return dbPost ? withNormalizedPostFields(dbPost) : null;
  }
  const contentPost = await getPostFromContentBySlug(slug);
  if (dbPost) {
    return withNormalizedPostFields({
      ...dbPost,
      summary: pickBetterSummary(dbPost.summary, contentPost?.summary),
    });
  }
  if (!contentPost) return null;
  return withNormalizedPostFields(contentPost);
};
