function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashIp(ip: string | null, env: Env): Promise<string | null> {
  if (!ip) return null;
  const input = `${env.IP_HASH_SALT}:${ip}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return toHex(digest);
}

export function getClientIp(request: Request): string | null {
  // Cloudflare sets CF-Connecting-IP
  return request.headers.get("CF-Connecting-IP") || null;
}
