import type { APIContext } from "astro";
import { ensureAdminSchema, getDb } from "./d1";

const ADMIN_SESSION_COOKIE = "twaw_admin_session";
const ADMIN_CSRF_COOKIE = "twaw_admin_csrf";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 120000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

type AdminUser = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
};

type AdminLoginAttempt = {
  failedCount: number;
  lastAttempt: string;
  lockedUntil: string | null;
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

const getClientIp = (request: Request) => {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "";
  return forwarded.split(",")[0]?.trim() ?? "";
};

const canBootstrapSchema = (locals: APIContext["locals"]) =>
  locals.runtime?.env?.ALLOW_SCHEMA_BOOTSTRAP === "true";

export const checkAdminLoginRateLimit = async (request: Request, locals: APIContext["locals"]) => {
  const ip = getClientIp(request);
  if (!ip) return { allowed: true };
  const ipHash = await sha256(ip);
  const db = getDb(locals);
  await ensureAdminSchema(db, { allowBootstrap: canBootstrapSchema(locals) });
  const record = await db
    .prepare(
      `SELECT failed_count as failedCount, last_attempt as lastAttempt, locked_until as lockedUntil
       FROM admin_login_attempts
       WHERE ip_hash = ? LIMIT 1`
    )
    .bind(ipHash)
    .first<AdminLoginAttempt>();
  if (!record) return { allowed: true };
  const now = Date.now();
  if (record.lockedUntil) {
    const lockedUntilMs = new Date(record.lockedUntil).getTime();
    if (lockedUntilMs > now) {
      return { allowed: false, retryAfter: Math.ceil((lockedUntilMs - now) / 1000) };
    }
    await db.prepare(`DELETE FROM admin_login_attempts WHERE ip_hash = ?`).bind(ipHash).run();
    return { allowed: true };
  }
  if (record.lastAttempt) {
    const lastAttemptMs = new Date(record.lastAttempt).getTime();
    if (now - lastAttemptMs > LOGIN_WINDOW_MS) {
      await db.prepare(`DELETE FROM admin_login_attempts WHERE ip_hash = ?`).bind(ipHash).run();
    }
  }
  return { allowed: true };
};

export const recordAdminLoginFailure = async (request: Request, locals: APIContext["locals"]) => {
  const ip = getClientIp(request);
  if (!ip) return;
  const ipHash = await sha256(ip);
  const db = getDb(locals);
  await ensureAdminSchema(db, { allowBootstrap: canBootstrapSchema(locals) });
  const existing = await db
    .prepare(
      `SELECT failed_count as failedCount, last_attempt as lastAttempt, locked_until as lockedUntil
       FROM admin_login_attempts
       WHERE ip_hash = ? LIMIT 1`
    )
    .bind(ipHash)
    .first<AdminLoginAttempt>();
  const now = Date.now();
  let failedCount = existing?.failedCount ?? 0;
  if (existing?.lastAttempt) {
    const lastAttemptMs = new Date(existing.lastAttempt).getTime();
    if (now - lastAttemptMs > LOGIN_WINDOW_MS) {
      failedCount = 0;
    }
  }
  failedCount += 1;
  const lockedUntil =
    failedCount >= LOGIN_MAX_FAILURES ? new Date(now + LOGIN_LOCK_MS).toISOString() : null;
  await db
    .prepare(
      `INSERT INTO admin_login_attempts (ip_hash, failed_count, last_attempt, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET
         failed_count = excluded.failed_count,
         last_attempt = excluded.last_attempt,
         locked_until = excluded.locked_until`
    )
    .bind(ipHash, failedCount, new Date(now).toISOString(), lockedUntil)
    .run();
};

export const clearAdminLoginFailures = async (request: Request, locals: APIContext["locals"]) => {
  const ip = getClientIp(request);
  if (!ip) return;
  const ipHash = await sha256(ip);
  const db = getDb(locals);
  await ensureAdminSchema(db, { allowBootstrap: canBootstrapSchema(locals) });
  await db.prepare(`DELETE FROM admin_login_attempts WHERE ip_hash = ?`).bind(ipHash).run();
};

const DEFAULT_ADMIN_USERNAME = "admin";

export const getAdminPassword = (locals: APIContext["locals"]) =>
  locals.runtime?.env?.ADMIN_PASSWORD ?? null;

export const isSecureRequest = (request: Request) => {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }
  const cfVisitor = request.headers.get("cf-visitor");
  if (cfVisitor) {
    try {
      const data = JSON.parse(cfVisitor);
      if (typeof data?.scheme === "string") {
        return data.scheme === "https";
      }
    } catch {
      // ignore malformed cf-visitor header
    }
  }
  return new URL(request.url).protocol === "https:";
};

export const ensureAdminBootstrapUser = async (locals: APIContext["locals"]) => {
  const password = getAdminPassword(locals);
  if (!password) return;
  const db = getDb(locals);
  await ensureAdminSchema(db, { allowBootstrap: canBootstrapSchema(locals) });
  const existing = await db
    .prepare(`SELECT id FROM admin_users WHERE username = ? LIMIT 1`)
    .bind(DEFAULT_ADMIN_USERNAME)
    .first<{ id: string }>();
  if (existing?.id) return;
  const salt = crypto.randomUUID();
  const hash = await pbkdf2Hash(password, salt);
  await db
    .prepare(
      `INSERT INTO admin_users (id, username, password_hash, password_salt)
       VALUES (?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), DEFAULT_ADMIN_USERNAME, hash, salt)
    .run();
};

export const verifyAdminPassword = async (locals: APIContext["locals"], password: string) => {
  const db = getDb(locals);
  await ensureAdminSchema(db, { allowBootstrap: canBootstrapSchema(locals) });
  await ensureAdminBootstrapUser(locals);
  const { results } = await db
    .prepare(
      `SELECT id, username, password_hash, password_salt
       FROM admin_users`
    )
    .all<AdminUser>();
  if (!results?.length) return null;
  for (const user of results) {
    const hash = await pbkdf2Hash(password, user.password_salt);
    if (hash === user.password_hash) {
      return user;
    }
  }
  return null;
};

export const createAdminSession = async (locals: APIContext["locals"], adminUserId: string) => {
  const db = getDb(locals);
  await ensureAdminSchema(db, { allowBootstrap: canBootstrapSchema(locals) });
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
  await ensureAdminSchema(db, { allowBootstrap: canBootstrapSchema(locals) });
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
  await ensureAdminSchema(db, { allowBootstrap: canBootstrapSchema(locals) });
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

export const clearAdminCookies = (secure = false) => {
  const base = [
    `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    `${ADMIN_CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
  ];
  if (!secure) return base;
  return base.map((cookie) => `${cookie}; Secure`);
};

export const getCsrfTokenFromCookies = (request: Request) => {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies.get(ADMIN_CSRF_COOKIE) ?? "";
};

export const verifyCsrf = (request: Request) => {
  const requestOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get("origin");
  if (originHeader && originHeader !== requestOrigin) return false;
  const refererHeader = request.headers.get("referer");
  if (refererHeader) {
    try {
      if (new URL(refererHeader).origin !== requestOrigin) return false;
    } catch {
      return false;
    }
  }
  const headerToken = request.headers.get("x-csrf-token") ?? "";
  const cookies = parseCookies(request.headers.get("cookie"));
  const cookieToken = cookies.get(ADMIN_CSRF_COOKIE) ?? "";
  return Boolean(headerToken && cookieToken && headerToken === cookieToken);
};
