#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (q, def = "") =>
  new Promise((resolve) => rl.question(`${q}${def ? ` (${def})` : ""}: `, (a) => resolve((a || def).trim())));

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const main = async () => {
  const title = await ask("Title", "Untitled Entry");
  const slugDefault = slugify(title);
  const slug = await ask("Slug (url + folder name)", slugDefault);

  const description = await ask("Short description", "");
  const pubDate = await ask("Publish date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));

  const topic = await ask(
    "Topic (two-of-us | miu-notes | oriyinframes | grey-h | grown-up-yap | sad-music | film-visuals | random-numbers | screenshots | trash-bin | quotes | memes | taste-yap)",
    "two-of-us"
  );

  const author = await ask("Author", "");
  const location = await ask("Location", "");
  const eventTime = await ask("Event time (free text)", "");
  const writtenAt = await ask("Written at (free text)", "");
  const photoTime = await ask("Photos taken (free text)", "");
  const voiceMemo = await ask("Voice memo file (optional)", "");
  const voiceMemoTitle = await ask("Voice memo title (optional)", "");
  const videoUrl = await ask("Video URL (optional)", "");
  const videoPoster = await ask("Video poster (optional)", "");

  const photoCountStr = await ask("How many numbered photos? (01..N)", "0");
  const photoCount = Number(photoCountStr) || 0;

  const md = `---\n` +
    `title: "${title.replaceAll('"', '\\"')}"\n` +
    `description: "${description.replaceAll('"', '\\"')}"\n` +
    `pubDate: ${pubDate}\n` +
    `topic: ${topic}\n` +
    `cover: "/photos/${slug}/cover.jpg"\n` +
    `photoDir: "${slug}"\n` +
    `photoCount: ${photoCount}\n\n` +
    `author: "${author.replaceAll('"', '\\"')}"\n` +
    `location: "${location.replaceAll('"', '\\"')}"\n` +
    `eventTime: "${eventTime.replaceAll('"', '\\"')}"\n` +
    `writtenAt: "${writtenAt.replaceAll('"', '\\"')}"\n` +
    `photoTime: "${photoTime.replaceAll('"', '\\"')}"\n\n` +
    `voiceMemo: "${voiceMemo.replaceAll('"', '\\"')}"\n` +
    `voiceMemoTitle: "${voiceMemoTitle.replaceAll('"', '\\"')}"\n` +
    `videoUrl: "${videoUrl.replaceAll('"', '\\"')}"\n` +
    `videoPoster: "${videoPoster.replaceAll('"', '\\"')}"\n\n` +
    `tags: []\n` +
    `draft: true\n` +
    `sideNote: ""\n` +
    `---\n\n` +
    `Write here.\n`;

  const projectRoot = process.cwd();
  const mdPath = path.join(projectRoot, "src", "content", "posts", `${slug}.md`);
  const photoDirPath = path.join(projectRoot, "public", "photos", slug);

  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, md, "utf8");

  fs.mkdirSync(photoDirPath, { recursive: true });
  // leave a tiny file so the folder exists even in git
  const keepPath = path.join(photoDirPath, ".keep");
  if (!fs.existsSync(keepPath)) fs.writeFileSync(keepPath, "Drop cover.jpg + 01.jpg..N here.\n");

  console.log("\n✅ Created:");
  console.log(" -", mdPath);
  console.log(" -", photoDirPath);
  console.log("\nNext:");
  console.log(`1) Put images in: public/photos/${slug}/`);
  console.log("   - cover.jpg");
  console.log("   - 01.jpg, 02.jpg, ...");
  console.log("2) Set draft:false when ready.");
  console.log("3) Run: npm run dev\n");

  rl.close();
};

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
