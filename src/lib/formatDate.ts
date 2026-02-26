type FormatDateOptions = {
  includeTime?: boolean;
  locale?: string;
  timeZone?: string;
};

export function formatDate(input: Date | string, options: FormatDateOptions = {}) {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return typeof input === "string" ? input : "";

  const { includeTime = false, locale = "en-US", timeZone } = options;
  const baseOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    year: "numeric",
  };
  if (includeTime) {
    baseOptions.hour = "2-digit";
    baseOptions.minute = "2-digit";
    baseOptions.hour12 = false;
    baseOptions.timeZoneName = "short";
  }
  if (timeZone) {
    baseOptions.timeZone = timeZone;
  }

  try {
    return new Intl.DateTimeFormat(locale, baseOptions).format(date);
  } catch {
    // Fallback when timezone is invalid/missing in runtime.
    const fallback = { ...baseOptions };
    delete fallback.timeZone;
    return new Intl.DateTimeFormat(locale, fallback).format(date);
  }
}
