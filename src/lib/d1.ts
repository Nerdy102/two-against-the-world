import type { D1Database } from "@cloudflare/workers-types";

export type D1Env = {
  DB: D1Database;
};

export function getDb(locals: App.Locals): D1Database {
  const db = locals.runtime?.env?.DB;
  if (!db) {
    throw new Error("D1 database binding not found (DB).");
  }
  return db;
}

type PostColumnDefinition = {
  name: string;
  sql: string;
};

const POST_COLUMNS: PostColumnDefinition[] = [
  { name: "topic", sql: "topic TEXT" },
  { name: "location", sql: "location TEXT" },
  { name: "event_time", sql: "event_time TEXT" },
  { name: "written_at", sql: "written_at TEXT" },
  { name: "photo_time", sql: "photo_time TEXT" },
  { name: "tags_csv", sql: "tags_csv TEXT" },
  { name: "side_note", sql: "side_note TEXT" },
  { name: "voice_memo", sql: "voice_memo TEXT" },
  { name: "voice_memo_title", sql: "voice_memo_title TEXT" },
  { name: "photo_dir", sql: "photo_dir TEXT" },
  { name: "photo_count", sql: "photo_count INTEGER DEFAULT 0" },
  { name: "pinned", sql: "pinned INTEGER DEFAULT 0" },
];

let postsSchemaReady: Promise<void> | null = null;
let commentsSchemaReady: Promise<void> | null = null;
let reactionsSchemaReady: Promise<void> | null = null;

export async function ensurePostsSchema(db: D1Database): Promise<void> {
  if (postsSchemaReady) {
    return postsSchemaReady;
  }
  postsSchemaReady = (async () => {
    const { results } = await db
      .prepare("PRAGMA table_info(posts)")
      .all<{ name: string }>();
    const existing = new Set((results ?? []).map((row) => row.name));
    for (const column of POST_COLUMNS) {
      if (existing.has(column.name)) continue;
      await db.prepare(`ALTER TABLE posts ADD COLUMN ${column.sql}`).run();
    }
  })();
  return postsSchemaReady;
}

export async function ensureCommentsSchema(db: D1Database): Promise<void> {
  if (commentsSchemaReady) {
    return commentsSchemaReady;
  }
  commentsSchemaReady = (async () => {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          post_slug TEXT NOT NULL,
          parent_id TEXT,
          display_name TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'visible',
          ip_hash TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_comments_post_slug_created_at
         ON comments(post_slug, created_at)`
      )
      .run();
    await db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id)`)
      .run();
  })();
  return commentsSchemaReady;
}

export async function ensureReactionsSchema(db: D1Database): Promise<void> {
  if (reactionsSchemaReady) {
    return reactionsSchemaReady;
  }
  reactionsSchemaReady = (async () => {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS reactions (
          id TEXT PRIMARY KEY,
          post_slug TEXT NOT NULL,
          kind TEXT NOT NULL,
          visitor_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(post_slug, kind, visitor_id)
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_reactions_post_slug_kind
         ON reactions(post_slug, kind)`
      )
      .run();
  })();
  return reactionsSchemaReady;
}

export type PostRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content_md: string | null;
  cover_url: string | null;
  status: "draft" | "published";
  author: string | null;
  topic: string | null;
  location: string | null;
  event_time: string | null;
  written_at: string | null;
  photo_time: string | null;
  tags_csv: string | null;
  side_note: string | null;
  voice_memo: string | null;
  voice_memo_title: string | null;
  photo_dir: string | null;
  photo_count: number | null;
  pinned: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommentRecord = {
  id: string;
  post_slug: string;
  parent_id: string | null;
  display_name: string;
  body: string;
  status: "visible" | "pending" | "hidden";
  created_at: string;
  ip_hash?: string | null;
};

export type ReactionRecord = {
  post_slug: string;
  kind: string;
  count: number;
};
