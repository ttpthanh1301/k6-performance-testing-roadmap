## 🛡️ Bài 2.5: Làm chủ Authentication thực chiến (OAuth2 & JWT)

> **Mục tiêu bài học:** Hiểu bản chất thực sự của OAuth2 và JWT (JSON Web Token). Nắm vững quy trình lấy Token chuẩn xác trong k6, tránh "cú lừa" Content-Type, và áp dụng Biến môi trường (Environment Variables) để bảo mật mã nguồn.

---

### 📖 1. Giải ngố Lý thuyết: OAuth2 và JWT là gì?

Trước khi viết code, chúng ta cần phân biệt rõ hai khái niệm thường đi liền với nhau này:

#### 🔑 OAuth2 (Open Authorization 2.0)

OAuth2 **không phải là một công nghệ**, nó là một **tiêu chuẩn (Protocol/Framework)** dùng để cấp quyền truy cập (Authorization).

- **Ví dụ đời thường:** Bạn đi khách sạn. Bạn đưa CCCD cho Lễ tân (Xác thực - Authentication). Lễ tân đưa cho bạn một cái Thẻ từ (Token). Bạn cầm Thẻ từ đó quét vào thang máy và cửa phòng để đi vào (Cấp quyền - Authorization). Bạn không cần phải trình CCCD cho cái cửa phòng nữa.
- **Trong hệ thống phần mềm:**
  1.  **Authorization Server (Anh Lễ tân):** Nơi bạn gửi `username/password` hoặc `client_id/secret` đến để xin cái thẻ từ (Token).
  2.  **Resource Server (Cái cửa phòng):** Máy chủ chứa các API lấy dữ liệu. Nó chỉ nhìn thẻ (Token) chứ không quan tâm bạn là ai.

#### 🎫 JWT (JSON Web Token)

Nếu OAuth2 là quy trình cấp thẻ từ, thì **JWT chính là cái Thẻ từ đó**.
JWT là một chuỗi mã hóa (thường có 3 phần ngăn cách bởi dấu chấm `xxxxx.yyyyy.zzzzz`). Bên trong JWT có chứa sẵn thông tin của người dùng (Tên, ID, Quyền hạn) và một chữ ký điện tử chống làm giả. Khi Resource Server nhận được JWT, nó tự dịch ra được thông tin mà không cần phải hỏi lại Authorization Server nữa.

_💡 Lợi thế của k6:_ k6 hỗ trợ xử lý luồng OAuth2 này cực kỳ mượt mà thông qua hàm `setup()`.

---

### 🚨 2. "Cú lừa" lớn nhất khi test OAuth2: Content-Type

Khi bạn gọi API Đăng nhập RESTful thông thường, bạn hay gửi dữ liệu dưới dạng JSON (`application/json`).
Tuy nhiên, theo chuẩn bảo mật quốc tế của OAuth2, khi gọi API lên Authorization Server để lấy Token, bạn **BẮT BUỘC** phải gửi dữ liệu dưới dạng **Form Data (`application/x-www-form-urlencoded`)**.

Nếu bạn dùng `JSON.stringify()` ở bước lấy Token OAuth2, server sẽ ngay lập tức vả lỗi `400 Bad Request`!
👉 **Cách giải quyết trong k6:** Rất đơn giản. Bạn chỉ cần truyền **nguyên cái Object JavaScript** vào hàm `http.post()`, k6 sẽ tự động ép kiểu nó thành Form Data cho bạn.

---

### 💻 3. Code chuẩn: Kịch bản OAuth2 (Grant Type: Password)

Đây là luồng phổ biến nhất khi test tải giả lập người dùng thật (User Login). Kịch bản dưới đây đã được nâng cấp với tính năng **bảo vệ kịch bản (Abort Test)** nếu lấy token thất bại.

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { exec } from "k6/execution"; // Import module để ngắt test khẩn cấp

// ==========================================
// 1. SETUP: Gọi Authorization Server lấy JWT
// ==========================================
export function setup() {
  const tokenEndpoint =
    "[https://your-auth-server.com/oauth/token](https://your-auth-server.com/oauth/token)";

  // ⚠️ CHÚ Ý: Không dùng JSON.stringify() ở đây!
  // Để nguyên Object để k6 tự động chuyển thành form-urlencoded
  const requestBody = {
    grant_type: "password",
    client_id: "my_k6_client", // ID của ứng dụng
    client_secret: "my_super_secret", // Mật khẩu của ứng dụng (nếu có)
    username: "testuser@example.com", // Tài khoản người dùng
    password: "password123", // Mật khẩu người dùng
    scope: "read write", // Quyền hạn muốn xin
  };

  const res = http.post(tokenEndpoint, requestBody);

  // Đảm bảo lấy Token thành công
  const loginSuccessful = check(res, {
    "Lấy OAuth2 Token thành công (200)": (r) => r.status === 200,
  });

  // 🛡️ BẢO VỆ: Nếu lỗi 401/500, ngắt bài test ngay lập tức để không chạy sinh ra toàn lỗi
  if (!loginSuccessful) {
    exec.test.abort("Đăng nhập lấy Token thất bại! Đang ngắt toàn bộ VUs...");
  }

  // Trích xuất JWT từ response (Thường nằm ở trường 'access_token')
  const jwtToken = res.json("access_token");

  return { token: jwtToken };
}

// ==========================================
// 2. VU STAGE: Gọi Resource Server bằng JWT
// ==========================================
export default function (data) {
  const apiUrl =
    "[https://api.your-system.com/secure-data](https://api.your-system.com/secure-data)";

  // Gắn JWT vào Header dưới chuẩn Bearer
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      "Content-Type": "application/json",
    },
  };

  const res = http.get(apiUrl, params);

  check(res, {
    "Truy cập dữ liệu thành công (200)": (r) => r.status === 200,
  });

  sleep(1);
}
```

### 🚀 4. Pro-Tip: Bảo mật mã nguồn với Biến Môi Trường (Env Variables)

Khi đi làm thực tế, việc "hardcode" (gắn cứng) mật khẩu hay `client_secret` thẳng vào file script là ĐIỀU CẤM KỴ. Nếu đẩy code lên Github, hệ thống của bạn sẽ bị lộ mật khẩu.

Giải pháp: Sử dụng biến môi trường `__ENV` của k6.

Bạn sửa lại cục `requestBody` trong code như sau:

```bash
const requestBody = {
    grant_type: "password",
    client_id: __ENV.CLIENT_ID || "default_client",
    client_secret: __ENV.CLIENT_SECRET, // Lấy từ bên ngoài vào
    username: __ENV.USERNAME,
    password: __ENV.PASSWORD,
  };
```

Sau đó, khi chạy k6 trên Terminal, bạn truyền thông tin thật vào thông qua cờ `-e` (environment):

```bash
# Chạy k6 và truyền tài khoản/mật khẩu an toàn từ bên ngoài
k6 run -e CLIENT_ID="my_client" -e CLIENT_SECRET="12345" -e USERNAME="admin" -e PASSWORD="password123" script.js
```

## 💡 Lợi ích: Kịch bản của bạn có thể tái sử dụng cho mọi môi trường (Dev, Staging, Production) chỉ bằng cách đổi các biến truyền vào ở Terminal mà không cần phải chạm vào dòng code nào!

### 🔍 5. Mở rộng: Luồng Client Credentials (Machine-to-Machine)

Nếu bạn không test người dùng (Mobile/Web) mà test backend gọi backend (Ví dụ: Service Thanh toán gọi sang Service Kho hàng), luồng OAuth2 lúc này là `Client Credentials`.

Rất đơn giản, bạn chỉ cần sửa lại `requestBody` trong hàm `setup()`: bỏ đi username/password và đổi grant_type:

```bash
const requestBody = {
    grant_type: "client_credentials",
    client_id: __ENV.CLIENT_ID,
    client_secret: __ENV.CLIENT_SECRET,
  };
```
