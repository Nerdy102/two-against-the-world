#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const slug = process.argv[2];
if (!slug) {
  console.log("Usage: npm run sync:photos -- <slug>");
  process.exit(0);
}

const projectRoot = process.cwd();
const photosDir = path.join(projectRoot, "public", "photos", slug);
const mdPath = path.join(projectRoot, "src", "content", "posts", `${slug}.md`);

if (!fs.existsSync(photosDir)) {
  console.error("Photos folder not found:", photosDir);
  process.exit(1);
}
if (!fs.existsSync(mdPath)) {
  console.error("Markdown file not found:", mdPath);
  process.exit(1);
}

const files = fs.readdirSync(photosDir);
const numbered = files
  .map((f) => {
    const m = f.match(/^(\d{2})\.(jpg|jpeg|png|webp)$/i);
    return m ? Number(m[1]) : null;
  })
  .filter((n) => n !== null);

const max = numbered.length ? Math.max(...numbered) : 0;

let md = fs.readFileSync(mdPath, "utf8");

// Update (or insert) photoCount
if (md.match(/^photoCount:\s*\d+/m)) {
  md = md.replace(/^photoCount:\s*\d+/m, `photoCount: ${max}`);
} else {
  md = md.replace(/^photoDir:\s*".*"\s*$/m, (m) => `${m}\nphotoCount: ${max}`);
}

fs.writeFileSync(mdPath, md, "utf8");

console.log(`✅ photoCount updated to ${max} in ${mdPath}`);
