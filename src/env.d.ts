/// <reference types="astro/client" />
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

type RuntimeEnv = {
  DB: D1Database;
  MEDIA: R2Bucket;
  ADMIN_PASSWORD?: string;
  TURNSTILE_SECRET?: string;
  ALLOW_SCHEMA_BOOTSTRAP?: string;
  DISABLE_HTML_CACHE?: string;
  COMMENTS_REQUIRE_REVIEW?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_R2_BASE_URL?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  PUBLIC_BUILD_SHA?: string;
  PUBLIC_BUILD_TIME?: string;
  PUBLIC_CF_STREAM_IFRAME_BASE?: string;
  PUBLIC_CF_STREAM_DELIVERY_BASE?: string;
  CF_PAGES_COMMIT_SHA?: string;
  CF_PAGES_BUILD_TIMESTAMP?: string;
  CF_ACCOUNT_ID?: string;
  CF_STREAM_TOKEN?: string;
  CF_STREAM_REQUIRE_SIGNED_URLS?: string;
  CF_STREAM_MAX_DURATION_SECONDS?: string;
  CF_STREAM_MAX_UPLOAD_BYTES?: string;
  GITHUB_SHA?: string;
  BUILD_SHA?: string;
  BUILD_TIME?: string;
  WORKER_NAME?: string;
  [key: string]: unknown;
};

declare global {
  namespace App {
    interface Locals {
      runtime?: {
        env?: RuntimeEnv;
      };
    }
  }

  interface ImportMetaEnv {
    readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
    readonly PUBLIC_R2_BASE_URL?: string;
    readonly PUBLIC_SITE_URL?: string;
    readonly PUBLIC_BUILD_SHA?: string;
    readonly PUBLIC_BUILD_TIME?: string;
    readonly PUBLIC_CF_STREAM_IFRAME_BASE?: string;
    readonly PUBLIC_CF_STREAM_DELIVERY_BASE?: string;
    readonly CF_PAGES_COMMIT_SHA?: string;
    readonly CF_PAGES_BUILD_TIMESTAMP?: string;
    readonly PUBLIC_ENABLE_CONTENT_FALLBACK?: string;
    readonly PUBLIC_ENABLE_PINNED_BADGE?: string;
    readonly PUBLIC_ENABLE_SITE_CREDITS?: string;
    readonly PUBLIC_ENABLE_IG_LINKS?: string;
    readonly PUBLIC_ENABLE_IG_EMBED?: string;
    readonly PUBLIC_IG_EMBED_URL?: string;
    readonly PUBLIC_ENABLE_ADMIN_DRAFT_SAVE?: string;
    readonly PUBLIC_ENABLE_COMPOSE_PAGE?: string;
    readonly PUBLIC_ENABLE_PINNED_FIELDS?: string;
    readonly PUBLIC_ENABLE_UPLOAD_HELPERS?: string;
    readonly PUBLIC_ENABLE_LOVE_WIDGETS?: string;
  }
}

export {};
