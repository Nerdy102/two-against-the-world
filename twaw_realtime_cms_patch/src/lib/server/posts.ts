import { datedSlug } from "./slugify";

export type DbPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  cover_key: string | null;
  topic: string | null;
  pinned: number;
  draft: number;
  author: string | null;
  created_at: number;
  updated_at: number;
  published_at: number | null;
};

function normalizeDbPost(row: any): DbPost {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    excerpt: row.excerpt ?? null,
    content_md: String(row.content_md ?? ""),
    cover_key: row.cover_key ?? null,
    topic: row.topic ?? null,
    pinned: Number(row.pinned ?? 0),
    draft: Number(row.draft ?? 1),
    author: row.author ?? null,
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
    published_at: row.published_at === null || row.published_at === undefined ? null : Number(row.published_at),
  };
}

export async function getPostBySlug(db: D1Database, slug: string): Promise<DbPost | null> {
  const row = await db
    .prepare(
      "SELECT id, slug, title, excerpt, content_md, cover_key, topic, pinned, draft, author, created_at, updated_at, published_at FROM posts WHERE slug = ? LIMIT 1"
    )
    .bind(slug)
    .first();
  return row ? normalizeDbPost(row) : null;
}

export async function getPublishedPosts(db: D1Database, limit = 50): Promise<DbPost[]> {
  const res = await db
    .prepare(
      "SELECT id, slug, title, excerpt, content_md, cover_key, topic, pinned, draft, author, created_at, updated_at, published_at FROM posts WHERE draft = 0 AND published_at IS NOT NULL ORDER BY pinned DESC, published_at DESC LIMIT ?"
    )
    .bind(limit)
    .all();
  return (res.results ?? []).map(normalizeDbPost);
}

export async function getAllPostsForAdmin(db: D1Database, limit = 200): Promise<DbPost[]> {
  const res = await db
    .prepare(
      "SELECT id, slug, title, excerpt, content_md, cover_key, topic, pinned, draft, author, created_at, updated_at, published_at FROM posts ORDER BY draft DESC, published_at DESC, updated_at DESC LIMIT ?"
    )
    .bind(limit)
    .all();
  return (res.results ?? []).map(normalizeDbPost);
}

export type UpsertPostInput = {
  id?: string;
  slug?: string;
  title: string;
  excerpt?: string | null;
  content_md: string;
  cover_key?: string | null;
  topic?: string | null;
  pinned?: boolean;
  draft?: boolean;
  author?: string | null;
  published_at?: number | null;
};

export async function upsertPost(db: D1Database, input: UpsertPostInput): Promise<DbPost> {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  const title = input.title.trim();
  if (!title) throw new Error("title_required");

  const slug = (input.slug?.trim() || datedSlug(title)).slice(0, 140);
  const excerpt = input.excerpt?.trim() ? input.excerpt.trim() : null;
  const content_md = input.content_md ?? "";
  const cover_key = input.cover_key ?? null;
  const topic = input.topic ?? null;
  const pinned = input.pinned ? 1 : 0;
  const draft = input.draft ? 1 : 0;

  const published_at = draft
    ? null
    : input.published_at !== undefined && input.published_at !== null
      ? input.published_at
      : now;

  await db
    .prepare(
      `INSERT INTO posts (id, slug, title, excerpt, content_md, cover_key, topic, pinned, draft, author, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         title = excluded.title,
         excerpt = excluded.excerpt,
         content_md = excluded.content_md,
         cover_key = excluded.cover_key,
         topic = excluded.topic,
         pinned = excluded.pinned,
         draft = excluded.draft,
         author = excluded.author,
         updated_at = excluded.updated_at,
         published_at = excluded.published_at`
    )
    .bind(
      id,
      slug,
      title,
      excerpt,
      content_md,
      cover_key,
      topic,
      pinned,
      draft,
      input.author ?? null,
      now,
      now,
      published_at
    )
    .run();

  const row = await db
    .prepare(
      "SELECT id, slug, title, excerpt, content_md, cover_key, topic, pinned, draft, author, created_at, updated_at, published_at FROM posts WHERE id = ? LIMIT 1"
    )
    .bind(id)
    .first();

  if (!row) throw new Error("upsert_failed");
  return normalizeDbPost(row);
}

export async function deletePost(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
}
