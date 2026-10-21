# CNC Note — Web & Windows

Soạn G-code và mô phỏng hình học phay/tiện trên canvas.

| Thư mục | Nội dung |
| --- | --- |
| [`web/`](web/) | Mã nguồn ứng dụng web, kiểm tra và công cụ đóng gói Windows |
| [`desktop/`](desktop/) | Chỉ file `.exe` chạy trên Windows 64-bit |

## Tải về máy tính

**[Tải CNC Note cho Windows (.exe, khoảng 96 MB)](https://github.com/ENY333/mpcnc-/raw/refs/heads/main/desktop/CNC-Note-1.0.0-Windows-x64.exe)**

Dùng Windows 10/11 **64-bit**. Tải xong mở file để chạy trực tiếp, không cần cài đặt,
không cần Node.js, trình duyệt hoặc Internet. Bản build chưa ký số.

Dùng **Mở** để nhập G-code, **Tải** để xuất `program.txt`. Bản nháp lưu riêng trong
ứng dụng trên máy. Để chuyển bản nháp từ web, tải file từ web rồi mở trong ứng dụng.

## Bản web

**[Mở CNC Note trên web](https://eny333.github.io/mpcnc-/web/)**

Địa chỉ cũ `https://eny333.github.io/mpcnc-/` tự chuyển đến `web/`.
Bản nháp trên cùng trình duyệt và cùng website vẫn dùng chung.

## Quy ước tiện

Z nằm ngang, X thẳng đứng, tâm trục chính là X0.
X40 trong code là Ø40, hình hiển thị đối xứng +20 / −20 qua đường tâm Z.
`CR=10` giữ bán kính cung 10; tròn kín trên G18 dùng I/K.
Hình đối xứng không nhân đôi chiều dài và bước chạy chương trình.
Các chu kỳ nâng cao có giới hạn; xem thông báo trong ứng dụng.

## Phát triển

Bản web không cần cài thư viện:

```sh
cd web
python3 -m http.server 8000
```

Đóng gói Windows với Node.js 24 và npm:

```sh
cd web
npm ci
npm test
npm run desktop
npm run build:win
```

Quá trình build tạo dữ liệu tạm trong `web/dist/`, rồi sao chép file `.exe` hoàn chỉnh
vào `desktop/`. Không commit `node_modules/` hoặc `dist/`.

[GitHub Actions](https://github.com/ENY333/mpcnc-/actions/workflows/windows-app.yml)
cũng tạo bản Windows khi thay đổi `web/`, tạo tag phiên bản hoặc chạy thủ công.
Bản build được lưu trong artifact **CNC-Note-Windows-x64**; file trong `desktop/`
là bản phát hành được đưa lên kho, không tự thay đổi khi workflow tạo artifact mới.
