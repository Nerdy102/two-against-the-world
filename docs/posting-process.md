# Quy trình đăng bài mới (đơn giản, dễ làm cùng trợ lý)

## 1) Chuẩn bị nội dung
- Viết nội dung chính (body) bằng Markdown.
- Chuẩn bị metadata:
  - `title`, `description`, `pubDate`, `topic`
  - `author`, `location`, `eventTime`, `writtenAt`, `photoTime`
  - (tuỳ chọn) `voiceMemo`, `voiceMemoTitle`, `videoUrl`, `videoPoster`, `tags`, `sideNote`

## 2) Chuẩn bị ảnh
Chọn **1 trong 2 cách**:

### Cách A — Ảnh theo số thứ tự (dùng gallery tự động)
1. Tạo thư mục ảnh: `public/photos/<slug>/`
2. Đặt ảnh theo số thứ tự: `01.jpg`, `02.jpg`, … (ít nhất 1 ảnh).
3. Đặt ảnh cover là `cover.jpg`.
4. Trong frontmatter:
   - `photoDir: "<slug>"`
   - `photoCount: <số ảnh>`
   - `cover: "/photos/<slug>/cover.jpg"`

### Cách B — Ảnh tên tuỳ ý (dùng ảnh chèn tay trong bài)
1. Tạo thư mục ảnh: `public/photos/<slug>/`
2. Giữ **tên ảnh gốc** (ví dụ `chat.png`, `IMG_1234.HEIC`, …).
3. Trong frontmatter:
   - `photoDir: "<slug>"`
   - `photoCount: 0`
4. Chèn ảnh trực tiếp trong body:
   - `![mô tả ảnh](/photos/<slug>/<ten-anh>)`

> Nếu chỉ có **1 ảnh** và tên ảnh không phải số thứ tự, hãy dùng **Cách B** để tránh hệ thống tự tìm `1.jpg`.

## 3) Tạo file bài viết
1. Tạo file mới tại `src/content/posts/YYYY-MM-DD-<slug>.md`
2. Dán frontmatter + body vào file.

## 4) Checklist nhanh trước khi gửi cho trợ lý
- [ ] Có file `.md` trong `src/content/posts`
- [ ] Có thư mục ảnh trong `public/photos/<slug>`
- [ ] `cover` trỏ đúng ảnh (nếu có)
- [ ] `photoCount` đúng theo cách bạn chọn
- [ ] Các đường dẫn ảnh trong body đúng tên ảnh thật

## 5) Cách phối hợp nhanh với trợ lý
Khi gửi yêu cầu, chỉ cần đưa:
1. **Tên file bài viết** (hoặc nội dung frontmatter).
2. **Danh sách tên ảnh** (giữ nguyên tên gốc).
3. **Ảnh nào là cover**.
4. Nếu có ảnh chèn tay, gửi **vị trí** muốn chèn trong bài.

Ví dụ ngắn:
```
slug: 2026-02-02-our-day
cover: cover.jpg
photos: chat.png, IMG_1234.HEIC
insert: chèn chat.png sau đoạn 2
photoCount: 0
```
