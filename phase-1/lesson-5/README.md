# Bài 1.5: Thiết lập Môi trường Phát triển (VS Code + Extensions)

> **Mục tiêu bài học:** Biến Visual Studio Code (VS Code) thành một "vũ khí" tối thượng để viết script k6. Nắm được cách cấu hình tự động gợi ý code (IntelliSense) cho các thư viện đặc thù của k6 để tăng tốc độ gõ phím và hạn chế lỗi sai.

---

## 🛠 1. Tại sao lại chọn Visual Studio Code?

k6 sử dụng JavaScript (ES6+) để viết kịch bản. Hiện tại, **Visual Studio Code (VS Code)** của Microsoft là trình soạn thảo mã nguồn mở hỗ trợ JavaScript/TypeScript tốt nhất thế giới. Nó nhẹ, miễn phí và có hệ sinh thái Extension khổng lồ.

Nếu máy bạn chưa có VS Code, hãy tải và cài đặt tại trang chủ: [code.visualstudio.com](https://code.visualstudio.com/)

---

## 🧩 2. Các Extensions "Must-have" (Bắt buộc phải có)

Để trải nghiệm code mượt mà nhất, bạn hãy mở VS Code, vào tab **Extensions** (phím tắt `Ctrl+Shift+X` hoặc `Cmd+Shift+X`) và cài đặt các tiện ích sau:

1. **Prettier - Code formatter:** * Giúp tự động căn lề, format code JavaScript cho đẹp mắt, dễ đọc và chuẩn chỉ mỗi khi bạn bấm Lưu (Save).
2. **ESLint:** * Đóng vai trò như một "cảnh sát chính tả". Nó sẽ gạch chân màu đỏ để cảnh báo ngay lập tức nếu bạn viết sai cú pháp JavaScript trước cả khi bạn chạy script.
3. **Material Icon Theme** *(Tùy chọn)*: 
   * Giúp đổi icon của các file/folder trong dự án nhìn trực quan và chuyên nghiệp hơn.

---

## 💡 3. Bí kíp cấu hình Autocomplete (IntelliSense) cho k6

**Vấn đề:** Mặc dù script k6 viết bằng JavaScript, nhưng các thư viện của nó (như `k6/http`, `k6/metrics`) lại được chạy trên nền Go (Engine của k6). Do đó, mặc định VS Code sẽ **không hiểu** các thư viện này là gì, dẫn đến việc không có gợi ý code (IntelliSense) và báo lỗi gạch chân ảo.

**Giải pháp:** Chúng ta cần tải gói định nghĩa kiểu dữ liệu (Type Definitions) của k6 về dự án.

*(Lưu ý: Bạn cần cài đặt [Node.js](https://nodejs.org/) trên máy tính để chạy được lệnh `npm` dưới đây. Nhắc lại: Node.js ở đây chỉ dùng để **tải thư viện gợi ý code**, k6 vẫn chạy độc lập không phụ thuộc vào Node.js).*

### Bước 1: Khởi tạo dự án
Tạo một thư mục mới cho dự án Load Test của bạn (ví dụ: `k6-performance-tests`), mở thư mục đó bằng VS Code. 
Mở Terminal trong VS Code (`Ctrl + ~`) và gõ lệnh:
```bash
npm init -y
```
(Lệnh này sẽ tạo ra một file package.json để quản lý dự án).

### Bước 2: Tải gói gợi ý code của k6 (@types/k6)
Tiếp tục gõ lệnh sau vào Terminal:
```bash
npm install --save-dev @types/k6
```
### Bước 3: Cấu hình jsconfig.json (Chỉ dẫn cho VS Code)
Tạo một file mới ở thư mục gốc của dự án, đặt tên là jsconfig.json và dán đoạn code sau vào:
```bash
JSON
{
  "compilerOptions": {
    "target": "ES6",
    "module": "commonjs",
    "lib": ["es6"]
  },
  "include": [
    "node_modules/@types/**/*.d.ts",
    "**/*.js"
  ]
}
```

✅ 4. Kiểm tra thành quả
Bây giờ, bạn hãy tạo một file mới tên là script.js.

Gõ thử dòng chữ import http... Nếu bạn thấy VS Code tự động gợi ý cú pháp import http from 'k6/http'; và khi bạn gõ http. nó hiện ra các hàm như get, post, put... thì xin chúc mừng! Môi trường của bạn đã được thiết lập hoàn hảo.

Việc có IntelliSense sẽ giúp bạn học k6 nhanh hơn gấp nhiều lần vì không phải lúc nào cũng cần mở tài liệu (Docs) ra xem hàm này cần truyền vào tham số gì.
### 1. Extension của k6 trên VS Code làm được gì?
Trên chợ ứng dụng của VS Code, có một extension chính thức tên là "k6 for Visual Studio Code" (ID: k6.k6 của Grafana Labs).
Tuy nhiên, extension này chỉ cung cấp các nút bấm (Run, Pause) trên giao diện để bạn chạy kịch bản trực tiếp trên VS Code thay vì gõ lệnh trên Terminal.

Đội ngũ kỹ sư của Grafana đã xác nhận rõ: Extension này không chứa bộ gợi ý code.
<img width="1062" height="792" alt="image" src="https://github.com/user-attachments/assets/f13e8429-3042-46a0-8889-68743e881fc6" />



### 2. Tại sao lại bắt buộc phải tải gói @types/k6?
VS Code vốn rất thông minh với JavaScript, nhưng lõi của k6 lại chạy bằng Go (Golang). Vì vậy, VS Code "mù tịt" về các hàm của k6 (như http.get, check, sleep).

Gói @types/k6 thực chất không chứa code chạy, mà nó chỉ là một cuốn "từ điển" để dạy cho VS Code biết các hàm của k6 viết như thế nào, tham số truyền vào ra sao. Việc dùng npm là cách chuẩn mực và nhanh nhất trên toàn cầu để tải cuốn từ điển này về.

### 💡 "Cách lách" nếu bạn KHÔNG muốn cài Node.js hay dùng lệnh npm
Nếu bạn cực kỳ ghét việc dùng lệnh npm hoặc không muốn cài Node.js vào máy tính, bạn có thể tự làm thủ công bằng cách tải trực tiếp cuốn từ điển đó về:

Tạo một file tên là **k6.d.ts** ngay trong thư mục dự án của bạn (để cùng chỗ với file test).

Copy toàn bộ nội dung từ điển tại link này (đây là mã nguồn gốc của gói @types/k6) và dán vào file đó:
👉 (Link GitHub - k6 type definitions)[https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/k6/index.d.ts]

Ở trên cùng của file script k6 (ví dụ script.js), bạn thêm dòng comment này vào dòng số 1:

JavaScript
/// <reference path="./k6.d.ts" />
import http from 'k6/http';
// ... VS Code sẽ bắt đầu gợi ý code cho bạn!
