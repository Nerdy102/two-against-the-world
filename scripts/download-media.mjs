import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const WRANGLER_FILE = path.join(process.cwd(), "wrangler.jsonc");
const DEFAULT_MANIFEST = path.join(process.cwd(), "export", "media.json");
const OUTPUT_DIR = path.join(process.cwd(), "export", "media");

const readBucketName = async () => {
  const raw = await fs.readFile(WRANGLER_FILE, "utf8");
  const data = JSON.parse(raw);
  const bucket = data?.r2_buckets?.[0]?.bucket_name;
  if (!bucket) throw new Error("Missing r2 bucket_name in wrangler.jsonc");
  return bucket;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const manifestArg = args.find((arg) => arg.startsWith("--manifest="));
  return {
    manifest: manifestArg ? manifestArg.split("=")[1] : DEFAULT_MANIFEST,
  };
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const main = async () => {
  const { manifest } = parseArgs();
  const bucket = await readBucketName();
  const raw = await fs.readFile(manifest, "utf8");
  const items = JSON.parse(raw);
  await ensureDir(OUTPUT_DIR);

  for (const item of items) {
    const key = item?.r2_key ?? null;
    if (!key) continue;
    const filePath = path.join(OUTPUT_DIR, key);
    await ensureDir(path.dirname(filePath));
    execSync(
      `wrangler r2 object get ${bucket} ${JSON.stringify(key)} --file ${JSON.stringify(filePath)}`,
      { stdio: "inherit" }
    );
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
