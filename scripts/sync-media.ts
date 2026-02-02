import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const MEDIA_DIR = path.join(process.cwd(), "public", "photos");
const WRANGLER_FILE = path.join(process.cwd(), "wrangler.jsonc");

const readBucketName = async () => {
  const raw = await fs.readFile(WRANGLER_FILE, "utf8");
  const data = JSON.parse(raw);
  const bucket = data?.r2_buckets?.[0]?.bucket_name;
  if (!bucket) throw new Error("Missing r2 bucket_name in wrangler.jsonc");
  return bucket;
};

const walk = async (dir: string, list: string[] = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, list);
    } else {
      list.push(full);
    }
  }
  return list;
};

const main = async () => {
  const bucket = await readBucketName();
  const files = await walk(MEDIA_DIR);
  for (const file of files) {
    const relative = path.relative(path.join(process.cwd(), "public"), file);
    const key = relative.replace(/\\/g, "/");
    execSync(
      `wrangler r2 object put ${bucket} ${JSON.stringify(key)} --file ${JSON.stringify(file)}`,
      { stdio: "inherit" }
    );
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
