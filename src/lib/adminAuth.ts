import type { APIContext } from "astro";
import { ensureAdminSchema, getDb } from "./d1";

const ADMIN_SESSION_COOKIE = "twaw_admin_session";
const ADMIN_CSRF_COOKIE = "twaw_admin_csrf";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 120000;

type AdminUser = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
};

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

const pbkdf2Hash = async (password: string, salt: string) => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const getAdminCredentials = (locals: APIContext["locals"]) => {
  const username = locals.runtime?.env?.ADMIN_USERNAME ?? null;
  const password = locals.runtime?.env?.ADMIN_PASSWORD ?? null;
  return { username, password };
};

export const getAdminPassword = (locals: APIContext["locals"]) =>
  locals.runtime?.env?.ADMIN_PASSWORD ?? null;

export const getAdminPassword = (locals: APIContext["locals"]) =>
  locals.runtime?.env?.ADMIN_PASSWORD ?? null;

export const ensureAdminBootstrapUser = async (locals: APIContext["locals"]) => {
  const { username, password } = getAdminCredentials(locals);
  if (!username || !password) return;
  const db = getDb(locals);
  await ensureAdminSchema(db);
  const existing = await db
    .prepare(`SELECT id FROM admin_users WHERE username = ? LIMIT 1`)
    .bind(username)
    .first<{ id: string }>();
  if (existing?.id) return;
  const salt = crypto.randomUUID();
  const hash = await pbkdf2Hash(password, salt);
  await db
    .prepare(
      `INSERT INTO admin_users (id, username, password_hash, password_salt)
       VALUES (?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), username, hash, salt)
    .run();
};

export const verifyAdminLogin = async (
  locals: APIContext["locals"],
  username: string,
  password: string
) => {
  const db = getDb(locals);
  await ensureAdminSchema(db);
  await ensureAdminBootstrapUser(locals);
  const user = await db
    .prepare(
      `SELECT id, username, password_hash, password_salt
       FROM admin_users
       WHERE username = ? LIMIT 1`
    )
    .bind(username)
    .first<AdminUser>();
  if (!user) return null;
  const hash = await pbkdf2Hash(password, user.password_salt);
  return hash === user.password_hash ? user : null;
};

export const createAdminSession = async (locals: APIContext["locals"], adminUserId: string) => {
  const db = getDb(locals);
  await ensureAdminSchema(db);
  const token = crypto.randomUUID();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO admin_sessions (id, session_token_hash, admin_user_id, expires_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), tokenHash, adminUserId, expiresAt)
    .run();
  return { token, expiresAt };
};

export const clearAdminSession = async (locals: APIContext["locals"], token: string) => {
  const db = getDb(locals);
  await ensureAdminSchema(db);
  const tokenHash = await sha256(token);
  await db
    .prepare(`DELETE FROM admin_sessions WHERE session_token_hash = ?`)
    .bind(tokenHash)
    .run();
};

export const getAdminSession = async (request: Request, locals: APIContext["locals"]) => {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies.get(ADMIN_SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const db = getDb(locals);
  await ensureAdminSchema(db);
  const session = await db
    .prepare(
      `SELECT admin_user_id as adminUserId, expires_at as expiresAt
       FROM admin_sessions
       WHERE session_token_hash = ?
       LIMIT 1`
    )
    .bind(tokenHash)
    .first<{ adminUserId: string; expiresAt: string }>();
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await clearAdminSession(locals, token);
    return null;
  }
  return { token, adminUserId: session.adminUserId };
};

export const requireAdminSession = async (request: Request, locals: APIContext["locals"]) => {
  const session = await getAdminSession(request, locals);
  return session?.adminUserId ?? null;
};

export const buildAdminSessionCookies = (token: string, csrfToken: string, secure: boolean) => {
  const sessionParts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) sessionParts.push("Secure");

  const csrfParts = [
    `${ADMIN_CSRF_COOKIE}=${encodeURIComponent(csrfToken)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) csrfParts.push("Secure");

  return [sessionParts.join("; "), csrfParts.join("; ")];
};

export const clearAdminCookies = () => [
  `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
  `${ADMIN_CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
];

export const getCsrfTokenFromCookies = (request: Request) => {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies.get(ADMIN_CSRF_COOKIE) ?? "";
};

export const verifyCsrf = (request: Request) => {
  const headerToken = request.headers.get("x-csrf-token") ?? "";
  const cookies = parseCookies(request.headers.get("cookie"));
  const cookieToken = cookies.get(ADMIN_CSRF_COOKIE) ?? "";
  return Boolean(headerToken && cookieToken && headerToken === cookieToken);
};
