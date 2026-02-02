const COOKIE_NAME = "twaw_admin";

export type AdminSession = {
  sub: "admin";
  author?: string;
  exp: number; // unix ms
};

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const parts = cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const [k, ...rest] = part.split("=");
    if (k === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function base64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  // btoa expects latin1 string
  const b64 = btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return b64;
}

function base64urlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const raw = atob(b64 + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64urlEncode(new Uint8Array(sig));
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAdminPassword(password: string, env: Env): Promise<boolean> {
  const hashed = await sha256Hex(password);
  return timingSafeEqual(hashed, env.ADMIN_PASSWORD_HASH);
}

// Not perfect constant-time (JS), but avoids obvious early-return differences.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function signAdminSession(session: AdminSession, env: Env): Promise<string> {
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify(session)));
  const sig = await hmacSha256(env.SESSION_SECRET, payload);
  return `${payload}.${sig}`;
}

export async function readAdminSession(request: Request, env: Env): Promise<AdminSession | null> {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacSha256(env.SESSION_SECRET, payload);
  if (!timingSafeEqual(sig, expected)) return null;

  try {
    const json = new TextDecoder().decode(base64urlDecode(payload));
    const data = JSON.parse(json) as AdminSession;
    if (!data || data.sub !== "admin" || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function adminCookie(token: string, maxAgeSeconds: number): string {
  // Cookie valid for /admin and /api/admin routes (and anything else) if needed.
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearAdminCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function requireAdmin(request: Request, env: Env): Promise<AdminSession> {
  const session = await readAdminSession(request, env);
  if (!session) {
    throw new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}
