const trimQuotes = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseValue = (rawValue) => {
  const value = rawValue.trim();
  if (!value) return "";
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((item) => trimQuotes(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && /^-?\d+(\.\d+)?$/.test(value)) {
    return numeric;
  }
  return trimQuotes(value);
};

export const parseFrontmatter = (raw) => {
  if (!raw.startsWith("---")) {
    return { data: {}, content: raw };
  }
  const lines = raw.split("\n");
  if (lines.length < 3) {
    return { data: {}, content: raw };
  }
  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    return { data: {}, content: raw };
  }
  const data = {};
  for (const line of lines.slice(1, endIndex)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const delimiterIndex = trimmed.indexOf(":");
    if (delimiterIndex === -1) continue;
    const key = trimmed.slice(0, delimiterIndex).trim();
    const value = trimmed.slice(delimiterIndex + 1);
    data[key] = parseValue(value);
  }
  const content = lines.slice(endIndex + 1).join("\n").replace(/^\s+/, "");
  return { data, content };
};

const serializeValue = (value) => {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(String(item))).join(", ")}]`;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  return JSON.stringify(String(value));
};

export const stringifyFrontmatter = (content, data) => {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    lines.push(`${key}: ${serializeValue(value)}`);
  }
  lines.push("---", "", content.trim(), "");
  return lines.join("\n");
};
