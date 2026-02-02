# two-against-the-world

## Local setup

```bash
npm install
npm run dev
```

Chạy Worker local (SSR):

```bash
wrangler dev
```

## Environment variables (Cloudflare)

Thiết lập trong Cloudflare Dashboard (Workers → Settings → Variables):

- `ADMIN_USERNAME` (required): username admin.
- `ADMIN_PASSWORD` (required): password admin (không commit vào repo).
- `PUBLIC_SITE_URL`: URL site (ví dụ `https://tinyeu.blog`).
- `PUBLIC_R2_BASE_URL`: base URL để render ảnh từ R2 (ví dụ `https://tinyeu.blog/media`).
- `PUBLIC_TURNSTILE_SITE_KEY`: public site key cho Turnstile.
- `TURNSTILE_SECRET`: secret key cho Turnstile.
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

## Cloudflare KV (SESSION)

Astro adapter dùng KV binding `SESSION` cho session nội bộ. Cấu hình đã có sẵn trong `wrangler.jsonc`; nếu chạy trên môi trường khác cần tạo KV namespace và gán binding `SESSION`.

## Image optimization (Cloudflare Workers)

Cloudflare Workers không hỗ trợ `sharp` runtime. Project đã cấu hình image service ở chế độ `compile` để tối ưu ảnh khi build (không dùng runtime sharp).

## D1 migrations

Áp dụng migrations local:

```bash
wrangler d1 migrations apply two-against-the-world --local
```

Áp dụng migrations lên remote:

```bash
wrangler d1 migrations apply two-against-the-world
```

Lưu ý: thêm migration pinning (`0004_pinned_fields.sql`) trước khi bật ghim bài.

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
- Đăng nhập bằng `ADMIN_USERNAME` + `ADMIN_PASSWORD`.
- CRUD bài viết, upload ảnh (R2), publish/unpublish, và duyệt comment.

## Tạo project mới (không update GitHub cũ)

Xem hướng dẫn chi tiết tại `docs/new-project.md` để sao chép project này thành một bản mới độc lập, không liên quan tới repo GitHub hiện tại.
