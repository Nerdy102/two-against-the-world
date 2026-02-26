import type { PostRecord } from "./d1";

const INVALID_TIME = Number.NEGATIVE_INFINITY;

const parseTime = (value: string | null | undefined): number => {
  if (!value) return INVALID_TIME;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : INVALID_TIME;
};

export const getPostSortTimestamp = (
  post: Pick<PostRecord, "published_at" | "created_at">
): number => {
  const published = parseTime(post.published_at);
  if (published !== INVALID_TIME) return published;
  return parseTime(post.created_at);
};

export const comparePostsByNewest = (
  a: Pick<PostRecord, "published_at" | "created_at">,
  b: Pick<PostRecord, "published_at" | "created_at">
): number => getPostSortTimestamp(b) - getPostSortTimestamp(a);

export const toDateKey = (value: string | null | undefined, timeZone?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (!timeZone) return date.toISOString().slice(0, 10);

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall back to UTC key if timezone is invalid.
  }
  return date.toISOString().slice(0, 10);
};
