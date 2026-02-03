import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { stringifyFrontmatter } from "./frontmatter.mjs";

const OUTPUT_ROOT = path.join(process.cwd(), "export");
const OUTPUT_DIR = path.join(OUTPUT_ROOT, "posts");
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
    force: args.has("--force"),
  };
};

const runWranglerQuery = (dbName, sql, local) => {
  const flags = local ? "--local" : "";
  const output = execSync(`wrangler d1 execute ${dbName} --json --command ${JSON.stringify(sql)} ${flags}`, {
    encoding: "utf8",
  });
  const parsed = JSON.parse(output);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
};

const normalizeTags = (row) => {
  if (row.tags_json) {
    try {
      const parsed = JSON.parse(String(row.tags_json));
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  if (row.tags_csv) {
    return String(row.tags_csv)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
};

const toDate = (value) => {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const main = async () => {
  const { dryRun, local, force } = parseArgs();
  const dbName = await readWranglerDbName();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const rows = runWranglerQuery(
    dbName,
    `SELECT * FROM posts ORDER BY datetime(published_at) DESC`,
    local
  );
  const comments = runWranglerQuery(
    dbName,
    `SELECT * FROM comments ORDER BY datetime(created_at) DESC`,
    local
  );
  const media = runWranglerQuery(
    dbName,
    `SELECT * FROM post_media ORDER BY datetime(created_at) DESC`,
    local
  );

  for (const row of rows) {
    const slug = row.slug || row.id;
    const frontmatter = {
      title: row.title,
      description: row.summary ?? "",
      pubDate: toDate(row.published_at ?? row.created_at),
      cover: row.cover_url ?? "",
      photoDir: row.photo_dir ?? "",
      photoCount: Number(row.photo_count ?? 0),
      pinned: Boolean(row.pinned ?? 0),
      pinnedPriority: Number(row.pinned_priority ?? 0),
      pinnedUntil: row.pinned_until ?? null,
      pinnedStyle: row.pinned_style ?? null,
      topic: row.topic ?? "two-of-us",
      author: row.author ?? "",
      location: row.location ?? "",
      eventTime: row.event_time ?? "",
      writtenAt: row.written_at ?? "",
      photoTime: row.photo_time ?? "",
      tags: normalizeTags(row),
      draft: row.status === "draft",
      sideNote: row.side_note ?? "",
      voiceMemo: row.voice_memo ?? "",
      voiceMemoTitle: row.voice_memo_title ?? "",
      layout: row.layout ?? "normal",
      sortOrder: Number(row.sort_order ?? 0),
    };
    const content = row.body_markdown ?? row.content_md ?? "";
    const output = stringifyFrontmatter(content, frontmatter);
    const filename = `${slug}.md`;
    const filepath = path.join(OUTPUT_DIR, filename);
    if (!force) {
      const exists = await fs
        .access(filepath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        if (!dryRun) continue;
      }
    }
    if (dryRun) {
      process.stdout.write(`-- ${filepath}\n`);
    } else {
      await fs.writeFile(filepath, output, "utf8");
    }
  }

  const manifests = [
    { name: "posts.json", data: rows },
    { name: "comments.json", data: comments },
    { name: "media.json", data: media },
  ];
  for (const manifest of manifests) {
    const filePath = path.join(OUTPUT_ROOT, manifest.name);
    if (dryRun) {
      process.stdout.write(`-- ${filePath}\n`);
    } else {
      await fs.writeFile(filePath, JSON.stringify(manifest.data, null, 2), "utf8");
    }
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
