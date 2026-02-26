type SummaryLinkParts = {
  summaryText: string;
  followUpUrl: string;
  followUpLabel: string;
};

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
const RAW_URL_RE = /https?:\/\/[^\s)]+/gi;
const ESCAPED_NEWLINE_RE = /\\r\\n|\\n|\\r/g;
const LINK_LABEL_LINE_RE = /^\s*(?:[-*•]\s*)?(?:stream\s*)?link\s*:?\s*$/gim;
const ORPHAN_LINK_TOKEN_RE = /(^|[\s(])(?:\[\s*)?link(?:\s*])?(?=$|[\s).,:;!?"'])/gim;

export const sanitizeSummaryText = (value: string | null | undefined): string => {
  if (typeof value !== "string") return "";
  return value
    .replace(ESCAPED_NEWLINE_RE, "\n")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const splitSummaryFollowUp = (value: string | null | undefined): SummaryLinkParts => {
  const normalized = sanitizeSummaryText(value);
  if (!normalized) {
    return { summaryText: "", followUpUrl: "", followUpLabel: "" };
  }

  MARKDOWN_LINK_RE.lastIndex = 0;
  RAW_URL_RE.lastIndex = 0;

  const markdownMatch = MARKDOWN_LINK_RE.exec(normalized);
  const rawUrlMatch = markdownMatch ? null : RAW_URL_RE.exec(normalized);
  const followUpUrl = markdownMatch?.[2]?.trim() || rawUrlMatch?.[0]?.trim() || "";
  const followUpLabel = markdownMatch?.[1]?.trim() || (followUpUrl ? "Link" : "");

  let summaryText = normalized
    .replace(MARKDOWN_LINK_RE, "")
    .replace(RAW_URL_RE, "")
    .replace(LINK_LABEL_LINE_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!followUpUrl) {
    summaryText = summaryText
      .replace(ORPHAN_LINK_TOKEN_RE, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return { summaryText, followUpUrl, followUpLabel };
};
