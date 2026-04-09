## 🔄 Bài 2.2: Vòng đời k6 Nâng cao (The Test Lifecycle)

> **Mục tiêu bài học:** Hiểu sâu về kiến trúc cốt lõi của k6 (Máy ảo JS độc lập). Nắm vững nguyên tắc hoạt động của 4 giai đoạn (Init, Setup, VU, Teardown) để chia sẻ dữ liệu an toàn, tránh lỗi rò rỉ bộ nhớ (memory leak) theo đúng chuẩn tài liệu Grafana.

---

### 🧠 1. Kiến trúc máy ảo của k6 (Tại sao lại cần Lifecycle?)

Điều quan trọng nhất bạn cần biết về kiến trúc k6: **Không có bộ nhớ chia sẻ (No Shared Memory) giữa các Virtual Users (VUs).** Trong k6, mỗi VU là một **Máy ảo JavaScript (JS VM)** hoạt động hoàn toàn độc lập. Việc này giúp k6 chạy đa luồng cực kỳ hiệu quả mà không bị "nghẽn", nhưng nó đặt ra một bài toán:
_Làm sao để 1000 VUs có thể dùng chung một Access Token mà không phải bắt cả 1000 VUs cùng gọi API Login?_

Đó là lý do k6 thiết kế **Vòng đời 4 giai đoạn (The 4 Lifecycle Stages)** để luân chuyển dữ liệu theo luồng một chiều từ lúc chuẩn bị cho đến lúc dọn dẹp.

---

### ⚙️ 2. Chi tiết 4 Giai đoạn (Stages) trong k6

#### 🔸 Giai đoạn 1: Khởi tạo (Init Stage)

- **Vị trí:** Phần code nằm ngoài cùng (Global scope).
- **Bản chất:** Được k6 gọi chạy **một lần cho mỗi VU** ngay khi VU đó được sinh ra (khởi động máy ảo JS).
- **Mục đích:** - Import thư viện, module.
  - Khai báo cấu hình `options` (số lượng VU, thời gian chạy).
  - **Đọc file tĩnh từ ổ cứng** bằng hàm `open()` (VD: đọc file `users.json`).
- **❌ Tuyệt đối không làm:** **Không được gọi API (HTTP requests)** ở giai đoạn này. k6 sẽ văng lỗi ngay lập tức vì mạng chưa được cấp phép hoạt động ở lúc khởi tạo.

#### 🔸 Giai đoạn 2: Chuẩn bị (Setup Stage)

- **Vị trí:** `export function setup() { ... }`
- **Bản chất:** Chạy **ĐÚNG 1 LẦN DUY NHẤT** cho toàn bộ quá trình test, _trước_ khi bất kỳ VU nào bắt đầu tấn công server.
- **Mục đích:** - Gọi API Đăng nhập (Login) bằng phương thức `POST` để lấy Token.
  - Tạo dữ liệu giả trên Database để chuẩn bị cho test.
- **Đặc quyền Data Flow:** Bất cứ thứ gì bạn `return` trong hàm `setup()`, k6 sẽ tự động đóng gói và truyền (pass) nó xuống hàm `default` và hàm `teardown`.

#### 🔸 Giai đoạn 3: Thực thi tải (VU Stage / Default Function)

- **Vị trí:** `export default function (data) { ... }` (Biến `data` chính là kết quả trả về từ `setup`).
- **Bản chất:** Chạy **lặp đi lặp lại liên tục** song song trên tất cả các VUs cho đến khi test kết thúc.
- **Mục đích:** Gửi request chính, kiểm tra (assert/check) phản hồi, mô phỏng hành vi trễ của người dùng bằng `sleep`.
- **❌ Tuyệt đối không làm:** **Không dùng hàm `open()`** đọc file ở đây. Việc mở ổ cứng để đọc file hàng ngàn lần một giây sẽ làm nghẽn máy tính của bạn.

#### 🔸 Giai đoạn 4: Dọn dẹp (Teardown Stage)

- **Vị trí:** `export function teardown(data) { ... }`
- **Bản chất:** Chạy **ĐÚNG 1 LẦN DUY NHẤT** ở cuối chu trình, sau khi tất cả các VUs đã dừng lại hẳn.
- **Mục đích:** Xóa dữ liệu rác đã tạo ở phần Setup, gửi webhook báo cáo lên Slack/Teams.

---

### 💻 3. Code mẫu Thực chiến (Lấy Token THẬT và truyền qua 4 Stages)

Dưới đây là kịch bản chuẩn mực. Chúng ta sẽ dùng API mở của **DummyJSON** để Đăng nhập lấy Token thật (không cần đăng ký tài khoản), sau đó truyền xuống cho các VU.

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

// ==========================================
// 1. INIT STAGE (Khởi tạo máy ảo)
// ==========================================
export const options = {
  vus: 3,        // Chạy 3 User ảo
  duration: "3s" // Chạy trong 3 giây
};

// ==========================================
// 2. SETUP STAGE (Chạy ĐÚNG 1 LẦN lấy Token)
// ==========================================
export function setup() {
  console.log("--- [SETUP]: Đang gọi API Đăng nhập lấy JWT Token ---");

  // Gửi POST request kèm tài khoản test có sẵn của hệ thống
  const loginRes = http.post("https://dummyjson.com/auth/login", {
    username: "emilys",
    password: "emilyspass",
  });

  // Trích xuất Token thật từ cục JSON trả về
  const realToken = loginRes.json("token");
  console.log("🔑 Đã lấy được Token: " + realToken.substring(0, 20) + "...");

  // Return object chứa Token để chia sẻ cho toàn bộ VUs
  return { authToken: realToken };
}

// ==========================================
// 3. VU STAGE (Chạy lặp đi lặp lại bởi nhiều VUs)
// ==========================================
export default function (data) {
  // Nhận 'data' từ kết quả return của setup()
  const params = {
    headers: {
      "Authorization": `Bearer ${data.authToken}`, // Gắn Token vào Header
      "Content-Type": "application/json"
    },
  };

  // Gọi API yêu cầu Token (Nếu không có Token sẽ bị báo lỗi 401 Unauthorized)
  const res = http.get("https://dummyjson.com/auth/me", params);

  check(res, {
    "Truy cập dữ liệu bảo mật thành công (Status 200)": (r) => r.status === 200,
  });

  sleep(1); // Giả lập người dùng đọc trang trong 1s
}

// ==========================================
// 4. TEARDOWN STAGE (Chạy 1 lần duy nhất lúc kết thúc)
// ==========================================
export function teardown(data) {
  console.log("--- [TEARDOWN]: Test kết thúc. Dọn dẹp dữ liệu... ---");
}
### ⚠️ 4. Những Anti-Pattern (Lỗi thiết kế) cần tuyệt đối tránh

**Biến đếm chung "ảo tưởng" (Global Counters):**
Nếu bạn khai báo `let` `count = 0`; ở Init Stage và trong VU Stage bạn viết code count++, bạn sẽ hy vọng đếm được tổng số request? Sai! Vì mỗi VU là một máy ảo riêng biệt, nên VU nào cũng tự thấy count = 1. Đừng bao giờ dùng biến global để chia sẻ trạng thái thay đổi giữa các VUs.

**Sửa đổi dữ liệu trả về từ Setup:**
Dữ liệu data truyền từ `setup()` xuống default function được k6 thiết kế ở dạng chỉ đọc (read-only) hoặc copy. Việc cố tình thay đổi giá trị của nó bên trong vòng lặp VU sẽ không có tác dụng lan truyền tới các VU khác.

**Phụ thuộc quá nhiều vào Setup:**
Nếu code trong `setup()` bị lỗi (VD: server từ chối đăng nhập, sập mạng), k6 sẽ đánh rớt (Abort) toàn bộ bài test ngay lập tức mà không chạy tiếp vào VU Stage. Do đó, hãy cẩn thận thêm logic kiểm tra (try/catch hoặc if/else) khi code phần setup.
```
