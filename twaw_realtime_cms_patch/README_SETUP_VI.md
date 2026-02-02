# Patch: Realtime comments + reactions + “publish là lên luôn” (D1 + R2 + Admin)

> Bạn **không cần** cấp quyền GitHub cho mình. Mình **không thể** push thẳng code lên repo của bạn.  
> Nhưng mình đã chuẩn bị **một folder patch** để bạn copy/paste vào repo `two-against-the-world`.

## 0) Bạn sẽ có gì sau patch này?

### Public (người đọc)
- ✅ **Comment realtime-ish** (poll mỗi 5s) và lưu vào **Cloudflare D1**.
- ✅ **Reaction ❤️** (toggle, chống spam bằng cookie visitor id) lưu vào D1.
- ✅ Comment có rate-limit cơ bản (1 comment / 15s / IP).
- ✅ Tùy chọn chống spam bằng **Cloudflare Turnstile** (bật bằng env var).

### Admin (bạn + người yêu)
- ✅ Trang **/admin**: login bằng mật khẩu.
- ✅ Soạn bài trên điện thoại: **Draft → Publish → lên site ngay**.
- ✅ Upload ảnh vào **Cloudflare R2**.
- ✅ Tối ưu ảnh iPhone: **HEIC → JPEG**, auto **resize** (max 2048px), **compress**, và **xóa metadata EXIF** (privacy).
- ✅ Chèn ảnh vào nội dung bằng một nút upload.

### Kỹ thuật
- Astro chuyển sang **SSR trên Cloudflare** (adapter `@astrojs/cloudflare`) để render bài từ D1 ngay lập tức.

---

## 1) Copy code patch vào repo

Copy toàn bộ nội dung folder patch này vào repo của bạn (giữ nguyên cấu trúc thư mục):

- `astro.config.mjs` (replace)
- `wrangler.jsonc` (merge/replace theo mẫu)
- `migrations/0001_init.sql` (thêm)
- `src/env.d.ts` (merge/replace)
- `src/pages/...` (thêm/replace)
- `src/lib/...` (thêm)
- `src/scripts/...` (thêm)

> Nếu repo bạn có các file cùng tên mà bạn đã custom nhiều, cứ copy trước rồi chỉnh lại UI sau; logic DB/API vẫn giữ.

---

## 2) Cài dependency

Trong repo:

```bash
npm i @astrojs/cloudflare marked heic2any
```

---

## 3) Tạo D1 + migrate schema

### 3.1 Tạo database D1
```bash
npx wrangler d1 create twaw-db
```

Nó sẽ trả về `database_id` → copy vào `wrangler.jsonc`.

### 3.2 Apply migrations
```bash
npx wrangler d1 migrations apply twaw-db
```

> Nếu bạn muốn local dev với D1, bạn có thể dùng `--local` (tùy setup wrangler phiên bản).

---

## 4) Tạo R2 bucket

```bash
npx wrangler r2 bucket create twaw-media
```

Patch này không cần public bucket vì ảnh sẽ được serve qua route `/media/...`.

---

## 5) Set secrets / env vars

### 5.1 Tạo hash mật khẩu admin

```bash
node scripts/hash-admin-password.mjs "mat_khau_rat_kin"
```

Copy chuỗi hex output.

### 5.2 Set secrets

```bash
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
npx wrangler secret put IP_HASH_SALT
```

- `ADMIN_PASSWORD_HASH`: paste hash ở bước trên
- `SESSION_SECRET`: random string dài (>= 32 ký tự)
- `IP_HASH_SALT`: random string dài (>= 32 ký tự)

### 5.3 (Optional) Bật Turnstile chống spam comment

Nếu bạn bật Turnstile:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put TURNSTILE_SITE_KEY
```

- `TURNSTILE_SITE_KEY` dùng ở frontend
- `TURNSTILE_SECRET_KEY` dùng verify ở backend

---

## 6) Deploy

Build:
```bash
npm run build
```

Deploy:
```bash
npx wrangler deploy
```

---

## 7) Dùng

- Viết bài: vào `https://your-domain.com/admin`
- Xem bài: `https://your-domain.com/entries`
- Comment & like: ngay dưới mỗi bài

---

## 8) Dự toán chi phí (Cloudflare)

**Cho blog cá nhân** thì thường rơi vào *$0/tháng* (dùng free tiers) nếu traffic không quá lớn.

- Workers: Free plan có giới hạn request/ngày (đủ cho blog cá nhân).
- D1: có free tier khá rộng (reads/writes/storage) – blog nhỏ rất khó chạm.
- R2: có free tier 10GB-month storage; sau đó tính theo GB và operations.
- Turnstile: có free plan.

> Cái bạn có thể tốn thật sự: **domain** (tùy nơi mua).

---

## 9) Gợi ý bảo mật cho /admin (đáng làm)

- Cách nhanh: dùng password (patch đang dùng cách này).
- Cách “xịn” hơn: dùng **Cloudflare Access** để chỉ cho phép 2 email của bạn + người yêu truy cập `/admin` và `/api/admin/*`.
  - Khi bật Access, bạn có thể đặt password trong code đơn giản hơn rất nhiều.

---

## 10) Ghi chú

- Patch này **không làm video** (đúng theo yêu cầu). Video bạn xử lý backend riêng.
- Voice memo: upload endpoint đã sẵn sàng kiểu `kind=audio`, nhưng UI hiện ưu tiên ảnh.

Nếu bạn muốn bước tiếp theo (không đụng video):
- Moderation cho comment (ẩn/xóa, mark spam)
- Preview markdown đẹp hơn
- Tag/topic cố định theo `src/config/topics.ts`
- RSS cho DB posts
