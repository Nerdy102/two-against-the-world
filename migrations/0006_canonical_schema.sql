-- Canonical schema update for posts/comments/reactions
BEGIN TRANSACTION;

-- Posts (canonical columns + existing optional fields)
CREATE TABLE IF NOT EXISTS posts_new (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  author_name TEXT,
  topic TEXT NOT NULL DEFAULT 'uncategorized',
  body_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('draft','published','archived')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  pinned INTEGER NOT NULL DEFAULT 0,
  pinned_priority INTEGER NOT NULL DEFAULT 0,
  pinned_until TEXT,
  pinned_style TEXT,
  cover_key TEXT,
  cover_url TEXT,
  tags_json TEXT,
  content_md TEXT,
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
  layout TEXT DEFAULT 'normal',
  sort_order INTEGER DEFAULT 0
);

INSERT INTO posts_new (
  id,
  slug,
  title,
  summary,
  author_name,
  topic,
  body_markdown,
  status,
  published_at,
  created_at,
  updated_at,
  pinned,
  pinned_priority,
  pinned_until,
  pinned_style,
  cover_key,
  cover_url,
  tags_json,
  content_md,
  location,
  event_time,
  written_at,
  photo_time,
  tags_csv,
  side_note,
  voice_memo,
  voice_memo_title,
  photo_dir,
  photo_count,
  layout,
  sort_order
)
SELECT
  id,
  slug,
  title,
  summary,
  author,
  COALESCE(topic, 'uncategorized'),
  COALESCE(body_markdown, content_md, ''),
  CASE
    WHEN status IN ('draft','published','archived') THEN status
    ELSE 'draft'
  END,
  published_at,
  COALESCE(created_at, datetime('now')),
  COALESCE(updated_at, datetime('now')),
  COALESCE(pinned, 0),
  COALESCE(pinned_priority, 0),
  pinned_until,
  pinned_style,
  cover_key,
  cover_url,
  tags_json,
  content_md,
  location,
  event_time,
  written_at,
  photo_time,
  tags_csv,
  side_note,
  voice_memo,
  voice_memo_title,
  photo_dir,
  COALESCE(photo_count, 0),
  layout,
  sort_order
FROM posts;

DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE INDEX IF NOT EXISTS idx_posts_status_published_at
  ON posts(status, published_at);

CREATE INDEX IF NOT EXISTS idx_posts_pinned_priority
  ON posts(pinned, pinned_priority, pinned_until, published_at);

-- Comments (remove post_id, keep canonical columns)
CREATE TABLE IF NOT EXISTS comments_new (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('visible','pending','hidden')),
  created_at TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  parent_id TEXT
);

INSERT INTO comments_new (
  id,
  post_slug,
  display_name,
  body,
  status,
  created_at,
  ip_hash,
  user_agent_hash,
  parent_id
)
SELECT
  id,
  post_slug,
  display_name,
  body,
  CASE
    WHEN status IN ('visible','pending','hidden') THEN status
    ELSE 'visible'
  END,
  created_at,
  ip_hash,
  user_agent_hash,
  parent_id
FROM comments;

DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;

CREATE INDEX IF NOT EXISTS idx_comments_post_slug_created_at
  ON comments(post_slug, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id
  ON comments(parent_id);

-- Reactions (aggregate per slug/kind)
CREATE TABLE IF NOT EXISTS reactions_new (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_slug, kind)
);

INSERT INTO reactions_new (id, post_slug, kind, count, updated_at)
SELECT
  lower(hex(randomblob(16))),
  post_slug,
  kind,
  COUNT(*) as count,
  datetime('now')
FROM reactions
GROUP BY post_slug, kind;

DROP TABLE reactions;
ALTER TABLE reactions_new RENAME TO reactions;

CREATE INDEX IF NOT EXISTS idx_reactions_post_slug_kind
  ON reactions(post_slug, kind);

COMMIT;
