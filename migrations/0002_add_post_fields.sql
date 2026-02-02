-- Add missing fields to posts table used by the app UI and APIs
ALTER TABLE posts ADD COLUMN topic TEXT;
ALTER TABLE posts ADD COLUMN location TEXT;
ALTER TABLE posts ADD COLUMN event_time TEXT;
ALTER TABLE posts ADD COLUMN written_at TEXT;
ALTER TABLE posts ADD COLUMN photo_time TEXT;
ALTER TABLE posts ADD COLUMN tags_csv TEXT;
ALTER TABLE posts ADD COLUMN side_note TEXT;
ALTER TABLE posts ADD COLUMN voice_memo TEXT;
ALTER TABLE posts ADD COLUMN voice_memo_title TEXT;
ALTER TABLE posts ADD COLUMN photo_dir TEXT;
ALTER TABLE posts ADD COLUMN photo_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN pinned INTEGER DEFAULT 0;
