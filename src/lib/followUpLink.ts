type SummaryLinkParts = {
  summaryText: string;
  followUpUrl: string;
};

const MARKDOWN_LINK_RE = /\[[^\]]*]\((https?:\/\/[^\s)]+)\)/i;
const RAW_URL_RE = /https?:\/\/[^\s)]+/i;

const cleanupSummary = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();

export const splitSummaryFollowUp = (value: string | null | undefined): SummaryLinkParts => {
  const summary = typeof value === "string" ? value.trim() : "";
  if (!summary) {
    return { summaryText: "", followUpUrl: "" };
  }

  const markdownMatch = summary.match(MARKDOWN_LINK_RE);
  if (markdownMatch?.[1]) {
    const followUpUrl = markdownMatch[1];
    const summaryText = cleanupSummary(summary.replace(markdownMatch[0], ""));
    return { summaryText, followUpUrl };
  }

  const rawUrl = summary.match(RAW_URL_RE)?.[0] ?? "";
  if (!rawUrl) {
    return { summaryText: summary, followUpUrl: "" };
  }

  const summaryText = cleanupSummary(
    summary
      .replace(`(${rawUrl})`, "")
      .replace(rawUrl, "")
  );
  return { summaryText, followUpUrl: rawUrl };
};
