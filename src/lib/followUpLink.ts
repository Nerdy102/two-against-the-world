type SummaryLinkParts = {
  summaryText: string;
  followUpUrl: string;
};

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
const RAW_URL_RE = /https?:\/\/[^\s)]+/gi;
const ESCAPED_NEWLINE_RE = /\\r\\n|\\n|\\r/g;
const LINK_LABEL_LINE_RE = /^\s*(?:[-*•]\s*)?(?:stream\s*)?link\s*:?\s*$/gim;

// Policy: summary is plain intro text only (no URLs).
export const sanitizeSummaryText = (value: string | null | undefined): string => {
  if (typeof value !== "string") return "";
  return value
    .replace(ESCAPED_NEWLINE_RE, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(MARKDOWN_LINK_RE, "$1")
    .replace(RAW_URL_RE, "")
    .replace(LINK_LABEL_LINE_RE, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const splitSummaryFollowUp = (value: string | null | undefined): SummaryLinkParts => {
  const summaryText = sanitizeSummaryText(value);
  if (!summaryText) {
    return { summaryText: "", followUpUrl: "" };
  }
  return { summaryText, followUpUrl: "" };
};
