# Từ Vựng — App học từ vựng tiếng Anh

App web (PWA) chạy trên iPhone. Không cần cài đặt, mở bằng Safari rồi
"Thêm vào MH chính" là có icon ngoài màn hình như app thật.

## Nội dung
- **1.507 từ** — nguồn NGSL + BSL + AWL, chia 35 chủ đề trong 5 nhóm:
  Văn phòng (325) · Đời sống (445) · Cao học (305) · Mua sắm (235) · Từ nền tảng (197)
- Mỗi từ có: nghĩa Việt · loại từ · phiên âm IPA · câu ví dụ Anh–Việt · cụm từ thường gặp

## Cách học
- **17 từ mới mỗi ngày** (đổi được trong Cài đặt). Vòng tròn đầy 100% khi học xong đủ số đó.
- Xong 17 từ mới → tự chuyển sang ôn các từ cũ đến hạn.
- Xong hết → **"Ôn thêm không giới hạn"**: đúng liên tiếp thì app tự bơm thêm từ mới,
  sai thì lùi về từ cũ và ôn lại đúng từ vừa sai.
- **Leitner 5 hộp**: đúng ngay lần đầu → lên hộp (ôn lại sau 2 / 4 / 8 / 16 ngày).
  Sai → về hộp 1, mai gặp lại.

## 4 chế độ thử thách
1. 📖 Anh → Việt (chọn nghĩa)
2. 📖 Việt → Anh (chọn từ)
3. 🔊 Nghe → Việt (bấm loa nghe rồi chọn nghĩa)
4. ⌨️ Việt → Anh (tự gõ ra từ — điểm gấp đôi)

Chọn sai thì được chọn lại; chọn đúng mới hiện bảng chi tiết về từ đó.

## Chạy thử trên máy
```
python3 -m http.server 8777 --directory .
```
Rồi mở http://localhost:8777

## Đưa lên mạng (GitHub Pages)
1. Tạo repository mới trên GitHub (ví dụ `tuvung`), để **Public**
2. Trong thư mục này chạy:
   ```
   git init
   git add .
   git commit -m "App hoc tu vung tieng Anh"
   git branch -M main
   git remote add origin https://github.com/<tên-tài-khoản>/tuvung.git
   git push -u origin main
   ```
3. Vào repo → **Settings → Pages** → Source chọn `main` / thư mục `/ (root)` → Save
4. Sau 1-2 phút link sẽ là: `https://<tên-tài-khoản>.github.io/tuvung/`
5. Gửi link đó cho người khác là họ dùng được ngay.

## Dữ liệu
Toàn bộ tiến trình lưu trong `localStorage` của máy người dùng — không gửi đi đâu cả.
Mỗi người có tiến trình riêng. Có nút **Sao lưu / Khôi phục** trong Cài đặt.

## Cấu trúc file
| File | Vai trò |
|---|---|
| `index.html` | Giao diện + CSS |
| `app.js` | Engine học (Leitner, chấm điểm, chuỗi ngày, thống kê) |
| `vocab.js` | 1.507 từ vựng |
| `manifest.json`, `sw.js` | Cấu hình PWA + chạy offline |
| `icon-*.png` | Icon ngoài màn hình |
