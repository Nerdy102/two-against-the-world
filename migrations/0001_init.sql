-- POSTS: bài viết (draft/published)
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  content_md TEXT NOT NULL,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  author TEXT NOT NULL, -- 'you' | 'partner'
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published_at
  ON posts(status, published_at);

-- MEDIA: ảnh/voice memo (file nằm trên R2, DB giữ URL + metadata)
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image','audio')),
  meta_json TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_type_created_at
  ON media(type, created_at);

-- COMMENTS: bình luận (có reply qua parent_id)
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  parent_id TEXT,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','pending','hidden')),
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_post_slug_created_at
  ON comments(post_slug, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id
  ON comments(parent_id);

-- REACTIONS: thả tim (mỗi visitor 1 lần / post)
CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  kind TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_slug, kind, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_post_slug_kind
  ON reactions(post_slug, kind);
