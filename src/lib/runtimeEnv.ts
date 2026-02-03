import type { APIContext } from "astro";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type RuntimeEnv = Record<string, unknown> & {
  ADMIN_PASSWORD?: string;
  ALLOW_SCHEMA_BOOTSTRAP?: string;
  DB?: D1Database;
  MEDIA?: R2Bucket;
  PUBLIC_R2_BASE_URL?: string;
  PUBLIC_BUILD_ID?: string;
  PUBLIC_BUILD_SHA?: string;
  PUBLIC_BUILD_TIME?: string;
  TURNSTILE_SECRET?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  BUILD_ID?: string;
  BUILD_SHA?: string;
  BUILD_TIME?: string;
  DEPLOY_ENV?: string;
  ENVIRONMENT?: string;
  NODE_ENV?: string;
  WORKER_NAME?: string;
  CF_PAGES?: string;
  CF_PAGES_BRANCH?: string;
  CF_PAGES_COMMIT_SHA?: string;
  CF_PAGES_BUILD_TIMESTAMP?: string;
  GITHUB_SHA?: string;
};

export const getRuntimeEnv = (locals: APIContext["locals"]): RuntimeEnv =>
  (locals.runtime?.env ?? {}) as RuntimeEnv;

export const isSchemaBootstrapEnabled = (env: RuntimeEnv) =>
  env.ALLOW_SCHEMA_BOOTSTRAP === "true";

export const asString = (value: unknown) => (typeof value === "string" ? value : "");

export const getBuildInfo = (env: RuntimeEnv) => {
  const id = asString(env.BUILD_ID) || asString(env.PUBLIC_BUILD_ID);
  const sha =
    asString(env.BUILD_SHA) ||
    asString(env.PUBLIC_BUILD_SHA) ||
    asString(env.CF_PAGES_COMMIT_SHA) ||
    asString(env.GITHUB_SHA);
  const time =
    asString(env.BUILD_TIME) ||
    asString(env.PUBLIC_BUILD_TIME) ||
    asString(env.CF_PAGES_BUILD_TIMESTAMP);
  return { id, sha, time };
};

export const getDeployTarget = (env: RuntimeEnv) =>
  env.CF_PAGES ? "pages" : "workers";

export const getEnvironmentName = (env: RuntimeEnv) =>
  asString(env.DEPLOY_ENV) ||
  asString(env.ENVIRONMENT) ||
  asString(env.CF_PAGES_BRANCH) ||
  asString(env.NODE_ENV);
