CREATE TABLE IF NOT EXISTS love_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  hour INTEGER NOT NULL DEFAULT 0,
  minute INTEGER NOT NULL DEFAULT 0,
  event_group TEXT NOT NULL DEFAULT 'extra',
  icon TEXT,
  note TEXT,
  accent_rgb TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_love_events_active
  ON love_events(is_active, event_group, month, day, created_at);
