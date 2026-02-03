export const COMMENT_STATUSES = ["visible", "pending", "hidden"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

const COMMENT_STATUS_ALIASES: Record<string, CommentStatus> = {
  approved: "visible",
  rejected: "hidden",
  deleted: "hidden",
};

export const normalizeCommentStatus = (value: string): CommentStatus | null => {
  if (COMMENT_STATUSES.includes(value as CommentStatus)) {
    return value as CommentStatus;
  }
  return COMMENT_STATUS_ALIASES[value] ?? null;
};

export const POST_STATUSES = ["draft", "published", "archived"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const REACTION_KINDS = [
  "🥺",
  "🤧",
  "😭",
  "🤡",
  "😎",
  "☺️",
  "😖",
  "😏",
  "🥹",
  "🤪",
  "🤓",
  "😈",
  "😼",
  "🫶🏻",
  "♥️",
  "🫀",
  "💞",
  "✌🏻",
  "🖕🏻",
  "💋",
  "👀",
] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const isReactionKind = (value: string): value is ReactionKind =>
  REACTION_KINDS.includes(value as ReactionKind);
