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
  { name: "summary", sql: "summary TEXT" },
  { name: "content_md", sql: "content_md TEXT" },
  { name: "body_markdown", sql: "body_markdown TEXT" },
  { name: "tags_json", sql: "tags_json TEXT" },
  { name: "cover_key", sql: "cover_key TEXT" },
  { name: "cover_url", sql: "cover_url TEXT" },
  { name: "status", sql: "status TEXT NOT NULL DEFAULT 'draft'" },
  { name: "author", sql: "author TEXT" },
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
  { name: "pinned_priority", sql: "pinned_priority INTEGER DEFAULT 0" },
  { name: "pinned_until", sql: "pinned_until TEXT" },
  { name: "pinned_style", sql: "pinned_style TEXT" },
  { name: "layout", sql: "layout TEXT DEFAULT 'normal'" },
  { name: "sort_order", sql: "sort_order INTEGER DEFAULT 0" },
  { name: "published_at", sql: "published_at TEXT" },
];

const COMMENT_COLUMNS: PostColumnDefinition[] = [
  { name: "post_id", sql: "post_id TEXT" },
  { name: "user_agent_hash", sql: "user_agent_hash TEXT" },
  { name: "status", sql: "status TEXT NOT NULL DEFAULT 'approved'" },
];

let postsSchemaReady: Promise<void> | null = null;
let commentsSchemaReady: Promise<void> | null = null;
let reactionsSchemaReady: Promise<void> | null = null;
let postMediaSchemaReady: Promise<void> | null = null;
let adminSchemaReady: Promise<void> | null = null;
let mediaSchemaReady: Promise<void> | null = null;

export async function ensurePostsSchema(db: D1Database): Promise<void> {
  if (postsSchemaReady) {
    return postsSchemaReady;
  }
  postsSchemaReady = (async () => {
    let { results } = await db
      .prepare("PRAGMA table_info(posts)")
      .all<{ name: string }>();
    if (!results?.length) {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            summary TEXT,
            content_md TEXT,
            body_markdown TEXT,
            tags_json TEXT,
            cover_key TEXT,
            cover_url TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            author TEXT,
            topic TEXT,
            location TEXT,
            event_time TEXT,
            written_at TEXT,
            photo_time TEXT,
            tags_csv TEXT,
            side_note TEXT,
            voice_memo TEXT,
            voice_memo_title TEXT,
            photo_dir TEXT,
            photo_count INTEGER DEFAULT 0,
            pinned INTEGER DEFAULT 0,
            pinned_priority INTEGER DEFAULT 0,
            pinned_until TEXT,
            pinned_style TEXT,
            layout TEXT DEFAULT 'normal',
            sort_order INTEGER DEFAULT 0,
            published_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`
        )
        .run();
      const refreshed = await db.prepare("PRAGMA table_info(posts)").all<{ name: string }>();
      results = refreshed.results;
    }
    const existing = new Set((results ?? []).map((row) => row.name));
    for (const column of POST_COLUMNS) {
      if (existing.has(column.name)) continue;
      await db.prepare(`ALTER TABLE posts ADD COLUMN ${column.sql}`).run();
    }
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_posts_status_published_at
         ON posts(status, published_at)`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_posts_pinned_priority
         ON posts(pinned, pinned_priority, pinned_until, published_at)`
      )
      .run();
  })();
  return postsSchemaReady;
}

export async function ensureCommentsSchema(db: D1Database): Promise<void> {
  if (commentsSchemaReady) {
    return commentsSchemaReady;
  }
  commentsSchemaReady = (async () => {
    let { results } = await db
      .prepare("PRAGMA table_info(comments)")
      .all<{ name: string }>();
    if (!results?.length) {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            post_slug TEXT NOT NULL,
            parent_id TEXT,
            display_name TEXT NOT NULL,
            body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'approved',
            ip_hash TEXT,
            user_agent_hash TEXT,
            post_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`
        )
        .run();
      const refreshed = await db.prepare("PRAGMA table_info(comments)").all<{ name: string }>();
      results = refreshed.results;
    }
    const existing = new Set((results ?? []).map((row) => row.name));
    for (const column of COMMENT_COLUMNS) {
      if (existing.has(column.name)) continue;
      await db.prepare(`ALTER TABLE comments ADD COLUMN ${column.sql}`).run();
    }
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

export async function ensureMediaSchema(db: D1Database): Promise<void> {
  if (mediaSchemaReady) {
    return mediaSchemaReady;
  }
  mediaSchemaReady = (async () => {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS media (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('image','audio')),
          meta_json TEXT,
          uploaded_by TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_media_type_created_at
         ON media(type, created_at)`
      )
      .run();
  })();
  return mediaSchemaReady;
}

export async function ensurePostMediaSchema(db: D1Database): Promise<void> {
  if (postMediaSchemaReady) {
    return postMediaSchemaReady;
  }
  postMediaSchemaReady = (async () => {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS post_media (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          r2_key TEXT NOT NULL,
          url TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_post_media_post_id
         ON post_media(post_id, sort_order)`
      )
      .run();
  })();
  return postMediaSchemaReady;
}

export async function ensureAdminSchema(db: D1Database): Promise<void> {
  if (adminSchemaReady) {
    return adminSchemaReady;
  }
  adminSchemaReady = (async () => {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS admin_users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS admin_sessions (
          id TEXT PRIMARY KEY,
          session_token_hash TEXT NOT NULL,
          admin_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at TEXT NOT NULL
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_admin_sessions_token
         ON admin_sessions(session_token_hash)`
      )
      .run();
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS comment_bans (
          id TEXT PRIMARY KEY,
          ip_hash TEXT NOT NULL UNIQUE,
          reason TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS admin_login_attempts (
          ip_hash TEXT PRIMARY KEY,
          failed_count INTEGER NOT NULL DEFAULT 0,
          last_attempt TEXT NOT NULL,
          locked_until TEXT
        )`
      )
      .run();
  })();
  return adminSchemaReady;
}

export type PostRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content_md: string | null;
  body_markdown?: string | null;
  tags_json?: string | null;
  cover_key?: string | null;
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
  pinned_priority?: number | null;
  pinned_until?: string | null;
  pinned_style?: string | null;
  layout?: "normal" | "long" | null;
  sort_order?: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommentRecord = {
  id: string;
  post_slug: string;
  post_id?: string | null;
  parent_id: string | null;
  display_name: string;
  body: string;
  status: "approved" | "pending" | "hidden" | "visible";
  created_at: string;
  ip_hash?: string | null;
  user_agent_hash?: string | null;
};

export type ReactionRecord = {
  post_slug: string;
  kind: string;
  count: number;
};
