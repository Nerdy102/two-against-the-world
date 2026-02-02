import { marked } from "marked";

// Server-side markdown -> HTML for DB-backed posts.
// We treat post content as trusted (only you two can publish).
// For user-generated content (comments), we NEVER render markdown.

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(md: string): string {
  return marked.parse(md ?? "") as string;
}
