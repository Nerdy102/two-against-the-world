export const TOPICS = [
  { slug: "two-of-us", label: "Hai đứa mình", icon: "💞", color: "#e35a6f" },
  { slug: "miu-notes", label: "Miu tâm sự", icon: "📝", color: "#f2b84b" },
  { slug: "oyirinframes", label: "oyirinframes", icon: "🎞️", color: "#6dc9ff" },
  { slug: "grown-up-yap", label: "yapping người lớn", icon: "🧠", color: "#9f7aea" },
  { slug: "sad-music", label: "nhạc văn nhẽo", icon: "🎵", color: "#6ee7b7" },
  { slug: "film-visuals", label: "phim thị ảnh", icon: "🎬", color: "#f59ab1" },
  { slug: "random-numbers", label: "Những con số ngẫu nhiên", icon: "🔢", color: "#f97316" },
  { slug: "screenshots", label: "Ảnh chụp màn hình", icon: "📸", color: "#60a5fa" },
  { slug: "quotes", label: "Quotes", icon: "📜", color: "#f8b4c9" },
  { slug: "memes", label: "Meme", icon: "😼", color: "#a3e635" },
  { slug: "taste-yap", label: "Taste yap", icon: "🍽️", color: "#fca5a5" },
  { slug: "vid-viu-viu", label: "Vid vìu vịu", icon: "📹", color: "#38bdf8" },
  { slug: "grey-h", label: "chữ H xám xịt", icon: "☁️", color: "#9fa5b8" },
  { slug: "trash-bin", label: "Thùng rác cảm xúc", icon: "🧸", color: "#94a3b8" },
] as const;

export type TopicSlug = (typeof TOPICS)[number]["slug"];

export const UI_LABELS = {
  entries: "🩸 Nhật ký “Tin Yêu”",
};

export const TOPIC_BY_SLUG: Record<
  string,
  { slug: string; label: string; icon: string; color: string }
> = Object.fromEntries(TOPICS.map((t) => [t.slug, t]));

export function topicLabel(slug: string | undefined) {
  if (!slug) return "Uncategorized";
  return TOPIC_BY_SLUG[slug]?.label ?? slug;
}

export function topicMeta(slug: string | undefined) {
  if (!slug)
    return {
      slug: "uncategorized",
      label: "Chưa phân loại",
      icon: "❔",
      color: "#a3a3a3",
    };
  return (
    TOPIC_BY_SLUG[slug] ?? { slug, label: slug, icon: "📌", color: "#a3a3a3" }
  );
}

export const TOPIC_COPY: Record<string, string> = {
  "two-of-us": "Just the two of us",
  "miu-notes": "Em này quắn và miên lắmmmmmmmmmmmm",
  "oyirinframes": "Khoảnh khắc lặng, ảnh kể chuyện tình.",
  "grey-h": "No cap, mong là không phải dùng đến thư mục này",
  "grown-up-yap":
    "Chính trị, kinh tế, đầu tư, tài chính,... mọi thứ mà người lớn cơ bản phải đắm chìm để trưởng thành",
  "sad-music": "Đứa con thứ nhất",
  "film-visuals": "Đứa con thứ hai",
  "random-numbers":
    "Cuộc sống của chúng tôi là những chuỗi sự kiện và chuỗi chữ số 'ảo vl' nên bắt buộc phải có thư mục riêng đấy",
  screenshots:
    "Mong là sẽ đủ chăm để up hết mọi screenshots thường ngày mà somehow đáng yêu vcl của chúng tôi",
  "trash-bin": "Thùng rác cảm xúc, chôn chữ cũ như trang thơ tàn.",
  quotes: "Quotes đủ thể loại, tao dự là chắc toàn meme quotes thôi :))))",
  memes: "Bà chúa soạn Meme - Uyên Trần",
  "taste-yap": "Gu mình là bữa tiệc chữ: place, food, style.",
  "vid-viu-viu": "climax của ngu + phá hoại + nhảm nhí + artistic",
};
