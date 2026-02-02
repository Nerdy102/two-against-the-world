/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    runtime?: {
      env?: {
        DB: D1Database;
        MEDIA: R2Bucket;
        TURNSTILE_SECRET?: string;
        PUBLIC_R2_BASE_URL?: string;
        PUBLIC_TURNSTILE_SITE_KEY?: string;
      };
    };
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}
