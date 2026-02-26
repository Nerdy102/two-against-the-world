# two-against-the-world

## Local setup (development)

```bash
npm install
npm run dev
```

Chạy Worker local (SSR) — **dùng `wrangler dev` để có `locals.runtime.env`**:

```bash
npx wrangler dev
```

Tạo `.dev.vars` ở root để chạy `wrangler dev` với env local:

```bash
ADMIN_PASSWORD=hoayeuuyen
PUBLIC_SITE_URL=http://localhost:4321
```

Nếu cần bootstrap schema local (development only), có thể set thêm:

```bash
ALLOW_SCHEMA_BOOTSTRAP=true
```

## Production setup (Cloudflare)

Thiết lập trong Cloudflare Dashboard (Workers → Settings → Variables/Secrets):

- `ADMIN_PASSWORD` (required): password admin (không commit vào repo).
- `PUBLIC_SITE_URL`: URL site (ví dụ `https://tinyeu.blog`).
- `PUBLIC_R2_BASE_URL`: base URL để render ảnh từ R2 (ví dụ `https://tinyeu.blog/media`).
- `PUBLIC_TURNSTILE_SITE_KEY`: public site key cho Turnstile.
- `TURNSTILE_SECRET`: secret key cho Turnstile.
- `COMMENTS_REQUIRE_REVIEW`: `true` để mọi comment vào trạng thái pending.
- `DISABLE_HTML_CACHE`: `true` để HTML trả về `Cache-Control: no-store`.
- `ALLOW_SCHEMA_BOOTSTRAP`: `true` để auto-create schema khi chạy local (production nên để `false`).
- `PUBLIC_BUILD_SHA`: short commit SHA hiển thị ở footer.
- `PUBLIC_BUILD_TIME`: build timestamp (ISO).
- `PUBLIC_ENABLE_CONTENT_FALLBACK`: bật fallback từ Markdown khi D1 rỗng (`true`/`false`).
- `PUBLIC_ENABLE_PINNED_BADGE`: hiển thị huy hiệu ghim trên card bài viết.
- `PUBLIC_ENABLE_SITE_CREDITS`: hiển thị credits ở footer.
- `PUBLIC_ENABLE_IG_LINKS`: bật Instagram link cards.
- `PUBLIC_ENABLE_IG_EMBED`: bật embed 1 post IG (lazy load).
- `PUBLIC_IG_EMBED_URL`: URL embed 1 post IG.
- `PUBLIC_ENABLE_ADMIN_DRAFT_SAVE`: lưu draft cục bộ trong Admin.
- `PUBLIC_ENABLE_COMPOSE_PAGE`: bật trang `/compose` (mặc định tắt).
- `PUBLIC_ENABLE_PINNED_FIELDS`: bật trường ghim bài trong Admin.
- `PUBLIC_ENABLE_UPLOAD_HELPERS`: bật UI hỗ trợ upload (progress/cancel).
- `PUBLIC_ENABLE_LOVE_WIDGETS`: bật day counter + clocks.
- `CF_ACCOUNT_ID`: Cloudflare account id (dùng cho Stream upload API).
- `CF_STREAM_TOKEN` (secret): API token có quyền Stream edit.
- `CF_STREAM_REQUIRE_SIGNED_URLS`: `true` nếu muốn Stream dùng signed URL.
- `CF_STREAM_MAX_DURATION_SECONDS`: giới hạn độ dài video khi tạo direct upload URL.
- `CF_STREAM_MAX_UPLOAD_BYTES`: giới hạn kích thước file video (mặc định 50GB).
- `PUBLIC_CF_STREAM_IFRAME_BASE`: base iframe player (default `https://iframe.videodelivery.net`).
- `PUBLIC_CF_STREAM_DELIVERY_BASE`: base delivery URL (default `https://videodelivery.net`).

Nếu muốn set nhanh bằng CLI:

```bash
wrangler secret put ADMIN_PASSWORD
wrangler secret put CF_STREAM_TOKEN
```

## Production bring-up checklist (tinyeu.blog / world1)

- Worker production: `two-against-the-world1` (https://tinyeu.blog).
- D1 binding: `DB` → database `two-against-the-world`.
- R2 binding: `MEDIA` → bucket `two-against-the-world-media`.
- Env/secrets required:
  - `ADMIN_PASSWORD` (required).
  - `PUBLIC_R2_BASE_URL` (required for media URLs).
  - `PUBLIC_SITE_URL` (https://tinyeu.blog).
  - Turnstile optional: `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`.
  - `COMMENTS_REQUIRE_REVIEW` should remain `false` by default.
- Repair schema (admin-only, idempotent):
  1. Unlock `/admin` with `ADMIN_PASSWORD`.
  2. From the same browser session, `POST /api/admin/repair-schema` with `X-CSRF-Token` header
     equal to the `twaw_admin_csrf` cookie.
- Verify health:
  - `GET https://tinyeu.blog/api/health` → `schema.postMedia` should be `true`.

## Sessions (không dùng Astro.session)

Project không dùng `Astro.session`. Admin session được quản lý bằng cookie + D1 nên **không cần** KV binding `SESSION` trong Cloudflare Workers.

## Image optimization (Cloudflare Workers)

Cloudflare Workers không hỗ trợ `sharp` runtime. Project đã cấu hình image service ở chế độ `compile` để tối ưu ảnh khi build (không dùng runtime sharp).

## D1 migrations

Áp dụng migrations local:

```bash
wrangler d1 migrations apply two-against-the-world --local
```

Áp dụng migrations lên remote:

```bash
wrangler d1 migrations apply two-against-the-world --remote
```

Lưu ý: thêm migration pinning (`0003_pinned_fields.sql`) trước khi bật ghim bài.
Production không nên rely vào auto-create schema (bật `ALLOW_SCHEMA_BOOTSTRAP=false`).

## Hybrid data workflow (Markdown ↔ D1)

Nguồn sự thật (canonical) khi chạy runtime là **D1**. Markdown trong repo là bản mirror/backup để chỉnh offline và sync lại.

Import Markdown → D1 (seed lần đầu hoặc chạy định kỳ):

```bash
npm run import:posts -- --local
```

Export D1 → Markdown (default export ra `./export/posts`):

```bash
npm run export:posts -- --local
```

Export comments/media manifests:
- `./export/comments.json`
- `./export/media.json`

Flags:

- `--dry-run`: chỉ in ra output, không ghi DB / file.
- `--force`: overwrite file đã tồn tại khi export.
- `--local`: chạy trên DB local của wrangler.

## Sync media lên R2 (optional)

Đẩy ảnh trong `public/photos` lên R2:

```bash
npm run sync:media
```

## Download media từ R2 (backup)

```bash
npm run download:media -- --manifest=export/media.json
```

## Admin

- Mở `/admin`.
- Đăng nhập bằng `ADMIN_PASSWORD`.
- CRUD bài viết, upload ảnh (R2), upload video lớn (Cloudflare Stream), publish/unpublish, và duyệt comment.

### Upload video lớn qua Cloudflare Stream

1. Set env/secrets:
   - `CF_ACCOUNT_ID`
   - `CF_STREAM_TOKEN`
2. Vào `/admin` -> phần `Video file (Cloudflare Stream)`.
3. Chọn file video, bấm `Upload video`.
4. Khi upload xong, hệ thống tự điền `video_url` + `video_poster`.
5. Cloudflare cần thêm vài phút để encode trước khi playback ổn định.

## Auto deploy (Cloudflare Pages Git integration)

Repo deploy qua Cloudflare Pages (Git integration). Thiết lập:

- Build command: `npm run build`
- Output: `dist`
- Root directory: repo root

Pages sẽ tự build khi push `main`. Build info lấy từ `CF_PAGES_COMMIT_SHA` + `CF_PAGES_BUILD_TIMESTAMP`.

## Cache purge (Cloudflare)

Nếu HTML bị cache cứng, có thể:

1. Bật env `DISABLE_HTML_CACHE=true` để disable cache HTML tạm thời.
2. Hoặc purge cache trong Cloudflare Dashboard → Caching → Purge Everything.

## Health check

`GET /api/health` trả về trạng thái env + build info để debug production nhanh.

Ví dụ response:

```json
{
  "ok": true,
  "workerName": "two-against-the-world1",
  "env": {
    "hasAdminPassword": true,
    "hasDBBinding": true,
    "hasR2Binding": true,
    "hasTurnstile": false
  },
  "schema": {
    "posts": true,
    "comments": true,
    "reactions": true,
    "adminUsers": true,
    "adminSessions": true,
    "commentBans": true,
    "adminLoginAttempts": true,
    "media": true,
    "postMedia": true
  },
  "build": {
    "sha": "abc123",
    "time": "2026-02-02T10:00:00Z"
  }
}
```

## Doctor mode (schema diagnostics)

`GET /api/diag/schema` (admin-only) trả về D1 schema cho các bảng quan trọng.

Ví dụ response:

```json
{
  "ok": true,
  "tables": {
    "posts": {
      "sql": "CREATE TABLE posts (... статус ...)",
      "checks": ["status IN ('draft','published')"]
    },
    "comments": {
      "sql": "CREATE TABLE comments (... статус ...)",
      "checks": ["status IN ('visible','pending','hidden')"]
    }
  }
}
```

## Integration test harness

Chạy worker local trước:

```bash
npx wrangler dev
```

Chạy integration test (cần `ADMIN_PASSWORD` trong `.dev.vars`):

```bash
ADMIN_PASSWORD=your_password npm run integration:test
```

Tuỳ chọn:
- `BASE_URL` (default `http://localhost:8788`) để test với URL khác.

## Fix lockfile / npm ci (Cloudflare build)

Cloudflare Pages dùng `npm ci`, nên cần lockfile sync:

```bash
rm -rf node_modules
npm install
git add package-lock.json
git commit -m "chore: refresh lockfile"
```

Nếu cần đồng bộ môi trường build:

```bash
npm -v   # nên là 10.9.2
node -v  # nên là 22.16.x
```

## Tạo project mới (không update GitHub cũ)

Xem hướng dẫn chi tiết tại `docs/new-project.md` để sao chép project này thành một bản mới độc lập, không liên quan tới repo GitHub hiện tại.
