# Kiểm tra chat và độ nét

## Kết quả kiểm tra mã

- Các kiểm tra cũ xử lý đúng `hey`, nhưng chủ yếu đưa sự kiện thẳng vào bộ xử lý; trước đây chưa kiểm tra đường WebSocket nhận từ TikFinity.
- TikFinity cài trên máy mở WebSocket tại IPv4 `127.0.0.1:21213`. Đã thay `localhost` bằng địa chỉ IPv4 này, thêm thời hạn chờ và xử lý kết nối lại.
- Bộ đọc sự kiện nhận cả gói văn bản và nhị phân; hỗ trợ ID người xem phẳng/lồng nhau, chữ hoa, chữ rộng và ký tự định dạng ẩn trong `hey`. Quà chuỗi và gói trùng vẫn chỉ cộng xu một lần.
- Bảng điều khiển tách số gói nhận, số tin chat và số sự kiện đã xử lý. Mở được cổng TikFinity không được mô tả là đã nhận chat từ phòng LIVE.
- Nguồn hình tiếp tục vẽ trực tiếp 1080 × 1920. Bảng điều khiển nhận kích thước thật của các trang nguồn đang mở và cảnh báo nguồn nhỏ/sai tỷ lệ.
- Chế độ ưu tiên độ nét giảm mật độ tia mảnh, hạt nền và ô LED nhỏ. Có thể chọn lại mật độ đầy đủ; chức năng quà và nhân vật giữ nguyên.
- `start.bat` nhận biết máy chủ đang chạy, cảnh báo phiên máy chủ cũ và tránh chạy thêm một máy chủ trùng cổng.

## Bằng chứng lần phát trước

Các thông số được trích riêng từ log LIVE Studio trên máy (không sao chép thông tin đăng nhập hoặc khóa phát): có nguồn 1080 × 1920, 30 FPS và cấu hình bitrate 4.800 kbps. Đây là cấu hình từng xuất hiện trong log, không đủ để khẳng định độ phân giải người xem thực nhận hoặc nguyên nhân duy nhất gây mờ.

## Kiểm tra đã thực hiện

```powershell
node --test engine.test.js connection.test.js
$env:RECORD_FULLHD='1'; node verify-preview.cjs
```

- 29 kiểm tra tự động đạt: gồm WebSocket thật trong môi trường thử → bộ xử lý → HTTP/SSE, `hey`, tin chat khác, gói nhị phân, gói sai, rớt mạng/nối lại, quà chuỗi và giới hạn truy cập.
- Kiểm tra trình duyệt trên máy chủ thử riêng đạt: nhân vật, cánh, phi kiếm, zoom/làm mờ nền, TOP, Full HD, nguồn sai kích thước, chế độ hiệu ứng và bố cục di động; không có lỗi JavaScript.
- Máy chủ thử không kết nối TikFinity thật và không dùng dữ liệu phòng LIVE hiện tại.
- Ảnh: `preview-connection-quality.png` và `preview-fullhd.png`.

## Cần xác nhận trong phòng thật

Khi kiểm tra ban đầu, máy chủ sàn và TikFinity đều không chạy. Không có bản ghi gói chat của lần thử trước để khẳng định chính xác vì sao `hey` hôm đó không tạo nhân vật.

1. Mở TikFinity Desktop, chạy `start.bat`, vào bảng điều khiển.
2. Mở nguồn Link `http://127.0.0.1:8080/#tiktok.studio` trong LIVE Studio; đặt nguồn 1080 × 1920 và đầu ra 1080p / 30 FPS.
3. Kết nối TikFinity với đúng username và phòng đang LIVE.
4. Dùng tài khoản xem khác bình luận `hey`. `TIN CHAT` phải tăng và tin gần nhất phải hiện `Đã xử lý`.
5. Nếu chỉ `GÓI NHẬN` tăng mà không có chat: kiểm tra loại sự kiện/phòng kết nối. Nếu cả hai bằng 0: TikFinity chưa chuyển dữ liệu phòng LIVE sang sàn.
6. Nếu sàn trên máy nét nhưng điện thoại mờ: kiểm tra chất lượng phát/đường truyền và chất lượng xem; thông báo nguồn Full HD không đo được quá trình TikTok nén hình.
