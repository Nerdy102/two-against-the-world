import type { APIContext } from "astro";

const ADMIN_COOKIE = "twaw_admin_session";
const DEFAULT_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const parseCookies = (cookieHeader: string | null) => {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return;
    map.set(rawKey, decodeURIComponent(rest.join("=")));
  });
  return map;
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const getAdminPassword = (locals: APIContext["locals"]) =>
  locals.runtime?.env?.ADMIN_PASSWORD ?? null;

export const getAdminSessionToken = async (locals: APIContext["locals"]) => {
  const explicitToken = locals.runtime?.env?.ADMIN_SESSION_TOKEN;
  if (explicitToken) return explicitToken;
  const password = getAdminPassword(locals);
  if (!password) return null;
  return sha256(password);
};

export const isAdminAuthorized = async (request: Request, locals: APIContext["locals"]) => {
  const token = await getAdminSessionToken(locals);
  if (!token) return false;
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies.get(ADMIN_COOKIE) === token;
};

export const buildAdminSessionCookie = (
  token: string,
  { maxAge = DEFAULT_SESSION_MAX_AGE, secure = false } = {}
) => {
  const attributes = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
};
