import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { parseFrontmatter } from "./frontmatter.mjs";

const POSTS_DIR = path.join(process.cwd(), "src", "content", "posts");
const WRANGLER_FILE = path.join(process.cwd(), "wrangler.jsonc");

const readWranglerDbName = async () => {
  const raw = await fs.readFile(WRANGLER_FILE, "utf8");
  const data = JSON.parse(raw);
  const db = data?.d1_databases?.[0]?.database_name;
  if (!db) throw new Error("Missing d1 database_name in wrangler.jsonc");
  return db;
};

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
    local: args.has("--local"),
  };
};

const slugify = (input = "") =>
  input
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const STREAM_UID_RE = /^[a-f0-9]{32}$/i;
const VIDEO_PATH_RE = /\.(mp4|m4v|mov|webm|ogv|ogg|m3u8)(?:[?#].*)?$/i;
const STREAM_HOST_RE = /(^|\.)videodelivery\.net$/i;
const STREAM_HOST_ALT_RE = /(^|\.)cloudflarestream\.com$/i;

const normalizeVideoUrl = (value) => String(value || "").trim();

const extractStreamUid = (value) => {
  const raw = normalizeVideoUrl(value);
  if (!raw) return "";
  if (STREAM_UID_RE.test(raw)) return raw.toLowerCase();
  let parsed = null;
  try {
    parsed = new URL(raw);
  } catch {
    if (/^[a-z0-9.-]+\.[a-z]{2,}\/?/i.test(raw)) {
      try {
        parsed = new URL(`https://${raw}`);
      } catch {
        return "";
      }
    } else {
      return "";
    }
  }
  if (!parsed) return "";
  const isStreamHost =
    STREAM_HOST_RE.test(parsed.hostname) || STREAM_HOST_ALT_RE.test(parsed.hostname);
  if (!isStreamHost) return "";
  const uidMatch = parsed.pathname.match(/\/([a-f0-9]{32})(?:[/?#]|$)/i);
  return uidMatch?.[1]?.toLowerCase() ?? "";
};

const isLikelyVideoUrl = (value) => {
  const raw = normalizeVideoUrl(value);
  if (!raw) return false;
  if (extractStreamUid(raw)) return true;
  if (VIDEO_PATH_RE.test(raw)) return true;
  if (raw.startsWith("/videos/")) return true;
  return false;
};

const toDateString = (value) => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const buildUpsert = (post) => {
  const columns = Object.keys(post);
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns
    .filter((col) => col !== "id")
    .map((col) => `${col} = excluded.${col}`)
    .join(", ");
  const sql = `INSERT INTO posts (${columns.join(", ")})
VALUES (${placeholders})
ON CONFLICT(slug) DO UPDATE SET ${updates};`;
  return { sql, params: columns.map((key) => post[key]) };
};

const quote = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
};

const runWrangler = (dbName, sql, local) => {
  const flags = local ? "--local" : "";
  execSync(`wrangler d1 execute ${dbName} --command ${JSON.stringify(sql)} ${flags}`, {
    stdio: "inherit",
  });
};

const main = async () => {
  const { dryRun, local } = parseArgs();
  const dbName = await readWranglerDbName();
  const entries = await fs.readdir(POSTS_DIR);
  const posts = [];

  for (const file of entries) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;
    const fullPath = path.join(POSTS_DIR, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const { data, content } = parseFrontmatter(raw);
    const slug = data.slug ? String(data.slug) : slugify(data.title || file.replace(/\.(md|mdx)$/, ""));
    const publishedAt = toDateString(data.pubDate);
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const rawVideoUrl = normalizeVideoUrl(data.videoUrl ? String(data.videoUrl) : "");
    const hasVideo = isLikelyVideoUrl(rawVideoUrl);
    const post = {
      id: randomUUID(),
      slug,
      title: String(data.title || slug),
      summary: data.description ? String(data.description) : null,
      content_md: content.trim(),
      body_markdown: content.trim(),
      tags_json: JSON.stringify(tags),
      cover_key: null,
      cover_url: data.cover ? String(data.cover) : null,
      status: data.draft ? "draft" : "published",
      author: data.author ? String(data.author) : null,
      topic: data.topic ? String(data.topic) : null,
      location: data.location ? String(data.location) : null,
      event_time: data.eventTime ? String(data.eventTime) : null,
      written_at: data.writtenAt ? String(data.writtenAt) : null,
      photo_time: data.photoTime ? String(data.photoTime) : null,
      tags_csv: tags.length ? tags.join(", ") : null,
      side_note: data.sideNote ? String(data.sideNote) : null,
      voice_memo: data.voiceMemo ? String(data.voiceMemo) : null,
      voice_memo_title: data.voiceMemoTitle ? String(data.voiceMemoTitle) : null,
      video_url: hasVideo ? rawVideoUrl : null,
      video_poster: hasVideo && data.videoPoster ? String(data.videoPoster) : null,
      photo_dir: data.photoDir ? String(data.photoDir) : null,
      photo_count: Number(data.photoCount ?? 0),
      pinned: data.pinned ? 1 : 0,
      pinned_priority: Number(data.pinnedPriority ?? 0),
      pinned_until: data.pinnedUntil ? String(data.pinnedUntil) : null,
      pinned_style: data.pinnedStyle ? String(data.pinnedStyle) : null,
      layout: data.layout ? String(data.layout) : "normal",
      sort_order: Number(data.sortOrder ?? 0),
      published_at: publishedAt,
      created_at: publishedAt,
      updated_at: new Date().toISOString(),
    };
    posts.push(post);
  }

  for (const post of posts) {
    const { sql, params } = buildUpsert(post);
    const statement = sql.replace(/\?/g, () => quote(params.shift()));
    if (dryRun) {
      process.stdout.write(`${statement}\n`);
    } else {
      runWrangler(dbName, statement, local);
    }
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
