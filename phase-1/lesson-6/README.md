
```markdown
## 👋 Bài 1.6: Kịch bản k6 đầu tiên (Hello World) & Vòng đời (Lifecycle)
```
> **Mục tiêu bài học:** Viết và chạy thành công kịch bản k6 đầu tiên. Đọc hiểu nhanh kết quả trả về và nắm vững 4 giai đoạn trong vòng đời (Lifecycle) để biết cách đặt code tối ưu nhất.

---

### 🌍 1. Kịch bản "Hello World" đầu tiên

Hãy mở VS Code, tạo một file tên là `hello-k6.js` và dán đoạn code cực kỳ đơn giản sau vào:

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

// Kịch bản chính: Hàm default sẽ được k6 gọi liên tục
export default function () {
  // Gửi một request GET đến một API test của k6
  http.get('https://test.k6.io');
  
  // Tạm nghỉ 1 giây trước khi vòng lặp tiếp theo bắt đầu (Giả lập thao tác người dùng)
  sleep(1); 
}
```

**Cách chạy kịch bản:**
Mở Terminal tại thư mục chứa file `hello-k6.js` và gõ lệnh chạy thử trong 5 giây với 1 User ảo (VU):
```bash
k6 run --vus 1 --duration 5s hello-k6.js
```
<img width="862" height="600" alt="image" src="https://github.com/user-attachments/assets/4557cad6-a4b9-44e6-acde-6604f390906c" />

---

### 📊 2. Giải mã trực tiếp Output của kịch bản Hello World

Ngay khi chạy xong lệnh trên, k6 sẽ in ra một bảng tổng kết (Summary). Hãy đối chiếu màn hình của bạn với các chỉ số quan trọng sau để biết hệ thống "Pass" hay "Fail":

* **`http_req_duration` (Thời gian phản hồi):**
  * `avg`: Trung bình phản hồi. *Chỉ mang tính chất tham khảo, không dùng làm SLA.*
  * **`p(95)`: ★ SLA quan trọng nhất.** Nếu kết quả hiển thị `p(95)=256.26ms`, có nghĩa là 95% request hoàn thành dưới mức 256.26ms. (Nếu dự án yêu cầu p95 < 300ms ➔ Test PASS).
* **`http_req_failed` (Tỉ lệ lỗi):**
  * Kết quả hiển thị `0.00%` ➔ Hoàn hảo! Không có lỗi xảy ra. Nếu chỉ số này `> 1%`, hệ thống đang gặp sự cố.
* **`iterations` (Số vòng lặp hoàn thành):**
  * Kết quả có thể là `3` hoặc `4`. Tại sao? Vì test chạy trong **5 giây**, mỗi vòng lặp tốn thời gian gọi mạng + `sleep(1)` (1 giây nghỉ). Nên 1 Virtual User chỉ có thể hoàn thành khoảng 3-4 vòng lặp. Hoàn toàn bình thường!

---

### 🔄 3. Vòng đời của k6 (The Test Lifecycle)

Trong k6, không phải dòng code nào cũng được chạy giống nhau. k6 chia quá trình thực thi thành **4 giai đoạn (stages)** riêng biệt. Việc hiểu sai vòng đời sẽ dẫn đến việc bạn viết code làm "cháy" RAM máy tính.

| Giai đoạn | Hàm thực thi | Chạy khi nào? | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **1. Init** | Code nằm ngoài cùng (Global scope) | Chạy 1 lần duy nhất khi khởi tạo script. | Import thư viện, đọc file ổ cứng (JSON, CSV), cấu hình `options`. |
| **2. Setup** | `export function setup()` | Chạy **đúng 1 lần** trước khi bắt đầu test. | Khởi tạo dữ liệu dùng chung (VD: Gọi API Login lấy Token). |
| **3. VU** | `export default function(data)` | Chạy **lặp đi lặp lại** liên tục bởi các VUs. | Gửi request chính, kiểm tra kết quả (Checks), giả lập người dùng. |
| **4. Teardown** | `export function teardown(data)` | Chạy **đúng 1 lần** sau khi test kết thúc. | Dọn dẹp dữ liệu (Xóa user ảo), gửi thông báo (Slack/Teams). |

---

### 💻 4. Ví dụ Code minh họa toàn bộ Lifecycle

Để thấy rõ thứ tự chạy, hãy tạo file `lifecycle.js` và chạy thử (`k6 run lifecycle.js`):

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

// ==========================================
// [1] INIT STAGE (Chạy đầu tiên)
// ==========================================
console.log(' [1] INIT STAGE: Đang khởi tạo script...');
export const options = { vus: 2, iterations: 4 };

// ==========================================
// [2] SETUP STAGE (Chạy 1 lần)
// ==========================================
export function setup() {
  console.log(' [2] SETUP STAGE: Lấy Token Login...');
  return { authToken: 'secret-token-123' }; // Truyền data xuống VU stage
}

// ==========================================
// [3] VU STAGE (Chạy lặp lại liên tục)
// ==========================================
export default function (data) {
  console.log(` [3] VU STAGE (User ${__VU}): Đang dùng token: ${data.authToken}`);
  http.get('https://test.k6.io');
  sleep(1);
}

// ==========================================
// [4] TEARDOWN STAGE (Chạy 1 lần cuối cùng)
// ==========================================
export function teardown(data) {
  console.log(' [4] TEARDOWN STAGE: Dọn dẹp dữ liệu...');
}
```

---

### 🛑 5. Sai lầm "Chết người" cần tránh

Nhiều người mới thường mắc lỗi: **Đọc file JSON lớn hoặc gọi API Login bên trong hàm `default function`.**

**Hậu quả:** Hàm `default` chạy liên tục hàng ngàn lần. Nếu test với 1000 User, k6 sẽ cố gắng mở file hoặc Login 1000 lần mỗi giây ➔ Sập máy tính sinh tải trước khi sập máy chủ.

**Quy tắc vàng:**
1. **Đọc file:** Đặt ở **Init**.
2. **Lấy Token (Login 1 lần dùng chung):** Đặt ở **Setup**.
3. **Thao tác API thực tế cần đánh giá hiệu năng:** Đặt ở **VU (`default`)**.
