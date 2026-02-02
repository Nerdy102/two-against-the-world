CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content_md TEXT,
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
  video_url TEXT,
  video_poster TEXT,
  photo_dir TEXT,
  photo_count INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts(slug);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  parent_id TEXT,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS comments_post_slug_idx ON comments(post_slug, created_at);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'heart',
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_slug, kind, visitor_id)
);

CREATE INDEX IF NOT EXISTS reactions_post_slug_idx ON reactions(post_slug, kind);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  uploaded_by TEXT
);
