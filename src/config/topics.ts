export const TOPICS = [
  { slug: "two-of-us", label: "Hai đứa mình" },
  { slug: "miu-notes", label: "Miu tâm sự" },
  { slug: "oriyinframes", label: "oriyinframes" },
  { slug: "grey-h", label: "chữ H xám xịt" },
  { slug: "grown-up-yap", label: "yapping về những topic người lớn" },
  { slug: "sad-music", label: "nhạc văn nhẽo" },
  { slug: "film-visuals", label: "phim thị ảnh" },
] as const;

export type TopicSlug = (typeof TOPICS)[number]["slug"];
export const UI_LABELS = {
  entries: '🩸 Nhật ký “Tin Yêu”',
};

export const TOPIC_BY_SLUG: Record<string, { slug: string; label: string }> = Object.fromEntries(
  TOPICS.map((t) => [t.slug, t])
);

export function topicLabel(slug: string | undefined) {
  if (!slug) return "Uncategorized";
  return TOPIC_BY_SLUG[slug]?.label ?? slug;
}
