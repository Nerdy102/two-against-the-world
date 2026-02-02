-- D1 schema for two-against-the-world
-- Notes:
-- - Store posts in D1 so "Publish" shows up immediately (SSR / runtime fetch).
-- - Store comments & reactions in D1 for realtime-ish interactions.
-- - Store uploads metadata in D1, while binaries live in R2.

PRAGMA foreign_keys = ON;

-- BLOG POSTS
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_md TEXT NOT NULL,
  cover_key TEXT,
  topic TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  draft INTEGER NOT NULL DEFAULT 1,
  author TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic);
CREATE INDEX IF NOT EXISTS idx_posts_draft ON posts(draft);

-- COMMENTS
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  ip_hash TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);

-- REACTIONS (per visitor)
CREATE TABLE IF NOT EXISTS reactions (
  post_slug TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_slug, visitor_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reactions_post_type ON reactions(post_slug, type);

-- UPLOADS (metadata only)
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  mime TEXT,
  size INTEGER,
  created_at INTEGER NOT NULL,
  uploader TEXT
);

CREATE INDEX IF NOT EXISTS idx_uploads_created ON uploads(created_at DESC);
