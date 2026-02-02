ALTER TABLE posts ADD COLUMN pinned_priority INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN pinned_until TEXT;
ALTER TABLE posts ADD COLUMN pinned_style TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_pinned_priority
  ON posts(pinned, pinned_priority, pinned_until, published_at);
