type FormatDateOptions = {
  includeTime?: boolean;
  locale?: string;
  timeZone?: string;
  showTimeZoneName?: boolean;
};

export function formatDate(input: Date | string, options: FormatDateOptions = {}) {
  const isDateOnlyString =
    typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim());
  const date = typeof input === "string"
    ? new Date(isDateOnlyString ? `${input.trim()}T00:00:00Z` : input)
    : input;
  if (Number.isNaN(date.getTime())) return typeof input === "string" ? input : "";

  const { includeTime = false, locale = "en-US", timeZone, showTimeZoneName = true } = options;
  const baseOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    year: "numeric",
  };
  if (includeTime) {
    baseOptions.hour = "2-digit";
    baseOptions.minute = "2-digit";
    baseOptions.hour12 = false;
    if (showTimeZoneName) {
      baseOptions.timeZoneName = "short";
    }
  }
  if (timeZone) {
    baseOptions.timeZone = timeZone;
  } else if (isDateOnlyString && !includeTime) {
    // Keep date-only values stable across viewer timezones.
    baseOptions.timeZone = "UTC";
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
