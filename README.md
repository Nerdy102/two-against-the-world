# two-against-the-world

## Local setup

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
```

Nếu cần bootstrap schema local (development only), có thể set thêm:

```bash
ALLOW_SCHEMA_BOOTSTRAP=true
```

## Environment variables (Cloudflare)

Thiết lập trong Cloudflare Dashboard (Workers → Settings → Variables):

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
- CRUD bài viết, upload ảnh (R2), publish/unpublish, và duyệt comment.

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
