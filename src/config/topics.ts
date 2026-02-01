export const TOPICS = [
  { slug: "two-of-us", label: "Hai đứa mình", icon: "💞", color: "#e35a6f" },
  { slug: "miu-notes", label: "Miu tâm sự", icon: "📝", color: "#f2b84b" },
  { slug: "oriyinframes", label: "oriyinframes", icon: "🎞️", color: "#6dc9ff" },
  { slug: "grey-h", label: "chữ H xám xịt", icon: "☁️", color: "#9fa5b8" },
  { slug: "grown-up-yap", label: "yapping người lớn", icon: "🧠", color: "#9f7aea" },
  { slug: "sad-music", label: "nhạc văn nhẽo", icon: "🎵", color: "#6ee7b7" },
  { slug: "film-visuals", label: "phim thị ảnh", icon: "🎬", color: "#f59ab1" },
  { slug: "random-numbers", label: "Những con số ngẫu nhiên", icon: "🔢", color: "#f97316" },
  { slug: "screenshots", label: "Screenshot", icon: "📸", color: "#60a5fa" },
  { slug: "trash-bin", label: "Thùng rác", icon: "🗑️", color: "#94a3b8" },
] as const;

export type TopicSlug = (typeof TOPICS)[number]["slug"];
export const UI_LABELS = {
  entries: "🩸 Nhật ký “Tin Yêu”",
};

export const TOPIC_BY_SLUG: Record<string, { slug: string; label: string; icon: string; color: string }> =
  Object.fromEntries(TOPICS.map((t) => [t.slug, t]));

export function topicLabel(slug: string | undefined) {
  if (!slug) return "Uncategorized";
  return TOPIC_BY_SLUG[slug]?.label ?? slug;
}

export function topicMeta(slug: string | undefined) {
  if (!slug) return { slug: "uncategorized", label: "Chưa phân loại", icon: "❔", color: "#a3a3a3" };
  return TOPIC_BY_SLUG[slug] ?? { slug, label: slug, icon: "📌", color: "#a3a3a3" };
}
