# CNC Note

Soạn G-code và xem hình học phay/tiện trên canvas. [Mở bản web](https://eny333.github.io/mpcnc-/).

## Ứng dụng Windows

Bản portable cho Windows 10/11 **64-bit**: `CNC-Note-1.0.0-Windows-x64.exe`.
Mở file để chạy, không cần cài Node.js hoặc kết nối Internet. Dùng **Mở** để nhập G-code,
**Tải** để xuất `program.txt`. Bản nháp được lưu riêng trong dữ liệu ứng dụng trên máy,
không tự chuyển từ bản nháp trên trình duyệt; hãy xuất file từ bản web rồi mở trong ứng dụng.

Tải bản build trong [GitHub Actions](https://github.com/ENY333/mpcnc-/actions/workflows/windows-app.yml):
chọn lần chạy **Build Windows app** thành công mới nhất, tải artifact **CNC-Note-Windows-x64**,
giải nén ZIP và mở file `.exe`. Các bản build chưa ký số.

## Quy ước tiện

Z nằm ngang, X thẳng đứng, tâm trục chính là X0.
X40 trong code là Ø40, hình hiển thị đối xứng +20 / −20 qua đường tâm Z.
`CR=10` giữ bán kính cung 10; tròn kín trên G18 dùng I/K.
Hình đối xứng không nhân đôi chiều dài và bước chạy chương trình.
Các chu kỳ nâng cao có giới hạn; xem thông báo trong ứng dụng.

## Phát triển và đóng gói

Yêu cầu Node.js 24 và npm. Trên Windows:

```sh
npm ci
npm test
npm run desktop
npm run build:win
```

File `.exe` nằm trong `dist/`. Workflow Windows chạy cùng các lệnh kiểm tra và đóng gói
khi có thay đổi trên `main`, khi tạo tag phiên bản hoặc chạy thủ công.
Không commit `node_modules/` và `dist/`.

Bản web không cần cài thư viện:

```sh
python3 -m http.server 8000
```
