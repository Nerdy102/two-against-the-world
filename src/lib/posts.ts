import { getCollection, getEntryBySlug } from "astro:content";
import type { CollectionEntry } from "astro:content";
import type { PostRecord } from "./d1";

const formatDate = (value: Date | undefined | null) =>
  value ? value.toISOString() : new Date().toISOString();

export const mapContentEntryToPostRecord = (
  entry: CollectionEntry<"posts">
): PostRecord => {
  const publishedAt = formatDate(entry.data.pubDate);
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.data.title,
    summary: entry.data.description || null,
    content_md: entry.body || null,
    body_markdown: entry.body || null,
    cover_url: entry.data.cover || null,
    status: entry.data.draft ? "draft" : "published",
    author_name: entry.data.author || null,
    topic: entry.data.topic || null,
    location: entry.data.location || null,
    event_time: entry.data.eventTime || null,
    written_at: entry.data.writtenAt || null,
    photo_time: entry.data.photoTime || null,
    tags_csv: entry.data.tags?.length ? entry.data.tags.join(", ") : null,
    side_note: entry.data.sideNote || null,
    voice_memo: entry.data.voiceMemo || null,
    voice_memo_title: entry.data.voiceMemoTitle || null,
    photo_dir: entry.data.photoDir || null,
    photo_count: entry.data.photoCount ?? 0,
    pinned: entry.data.pinned ? 1 : 0,
    pinned_priority: entry.data.pinnedPriority ?? 0,
    pinned_until: entry.data.pinnedUntil ? String(entry.data.pinnedUntil) : null,
    pinned_style: entry.data.pinnedStyle ? String(entry.data.pinnedStyle) : null,
    layout: "normal",
    sort_order: 0,
    published_at: publishedAt,
    created_at: publishedAt,
    updated_at: publishedAt,
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
  const entry = await getEntryBySlug("posts", slug);
  if (!entry || entry.data.draft) return null;
  return mapContentEntryToPostRecord(entry);
};

const getPostDate = (post: PostRecord) =>
  post.published_at ?? post.created_at ?? "";

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
  return getPostDate(b).localeCompare(getPostDate(a));
};

export const shouldUseContentFallback = () =>
  import.meta.env.PUBLIC_ENABLE_CONTENT_FALLBACK !== "false";

export const mergePostsBySlug = (
  dbPosts: PostRecord[],
  contentPosts: PostRecord[]
): PostRecord[] => {
  const map = new Map<string, PostRecord>();
  for (const post of dbPosts) {
    if (!post?.slug) continue;
    map.set(post.slug, post);
  }
  for (const post of contentPosts) {
    if (!post?.slug || map.has(post.slug)) continue;
    map.set(post.slug, post);
  }
  return Array.from(map.values()).sort(comparePosts);
};

export const getHybridPostBySlug = async (
  dbPost: PostRecord | null,
  slug: string
): Promise<PostRecord | null> => {
  if (dbPost) return dbPost;
  if (!shouldUseContentFallback()) return null;
  return getPostFromContentBySlug(slug);
};
