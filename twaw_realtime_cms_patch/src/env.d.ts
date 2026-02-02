/// <reference types="astro/client" />

// If you already have src/env.d.ts, replace/merge with this.

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;

  // Hash(SHA-256) of your admin password.
  ADMIN_PASSWORD_HASH: string;

  // Used to sign admin session cookies (HMAC SHA-256).
  SESSION_SECRET: string;

  // Used to hash IP addresses before saving (privacy).
  IP_HASH_SALT: string;

  // Optional anti-spam for comments.
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
}

// Tell Astro's Cloudflare adapter about our Env.
type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
