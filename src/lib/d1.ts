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
