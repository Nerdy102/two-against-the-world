export function formatDate(input: Date | string) {
  const d = typeof input === "string" ? new Date(input) : input;
  // Example output: "Jan 01, 2026"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}
