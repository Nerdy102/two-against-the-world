# Tạo project mới (không update GitHub cũ)

Mục tiêu: tạo một bản **project mới hoàn toàn**, không dính tới lịch sử commit hay remote GitHub cũ.

## Cách nhanh (khuyên dùng)
1. **Copy thư mục project** sang nơi mới:
   - Ví dụ: `cp -R two-against-the-world my-new-project`
2. Vào thư mục mới:
   - `cd my-new-project`
3. **Xoá dấu vết Git cũ**:
   - `rm -rf .git`
4. **Đổi tên project** trong `package.json`:
   - Sửa `"name": "two-against-the-world"` thành tên mới.
5. (Tuỳ chọn) Đổi tiêu đề hiển thị:
   - Nếu có branding trong nội dung, cập nhật các file liên quan.
6. **Khởi tạo Git mới**:
   - `git init`
   - `git add .`
   - `git commit -m "Initial commit"`
7. **Tạo repo GitHub mới** và push lên repo mới (nếu cần):
   - `git remote add origin <URL_REPO_MOI>`
   - `git push -u origin main`

## Checklist để đảm bảo là project mới
- [ ] Thư mục mới không còn `.git/`
- [ ] `package.json` đã đổi `name`
- [ ] Repo GitHub mới đã được tạo (nếu bạn muốn push)
- [ ] `git remote -v` chỉ trỏ tới repo mới

## Khi cần trợ lý hỗ trợ
Gửi cho tôi:
- Tên project mới
- Bạn muốn đổi gì (title, cover, nội dung, theme…)
- Bạn muốn tạo repo GitHub mới hay chỉ chạy local
