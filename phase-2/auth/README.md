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

<img width="565" height="313" alt="image" src="https://github.com/user-attachments/assets/b69eec10-01c8-4b85-8b8d-3862adbc44bb" />


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
### 🏗️ 6. JWT Token Pattern (Best Practices - 95% dự án áp dụng)
Đây là mô hình chuẩn hóa (Pattern) giúp bạn xử lý các dự án sử dụng Bearer Token một cách chuyên nghiệp, sạch sẽ và hạn chế tối đa lỗi kịch bản.

## 🛠️ Sơ đồ tư duy (Workflow)
_setup()_: Login đúng 1 lần duy nhất để lấy access_token.

_return {token}_: Đóng gói token và pass xuống cho toàn bộ Virtual Users.

_default(data)_: Mỗi VU nhận token từ tham số data.

_authHeaders_: Tái sử dụng token cho mọi request cần bảo mật.
```bash
import http from 'k6/http';
import { check, sleep } from 'k6';
import { exec } from 'k6/execution';

// Sử dụng biến môi trường để linh hoạt thay đổi Server test
const BASE_URL = __ENV.BASE_URL || 'https://api.example.com';

export function setup() {
  const url = `${BASE_URL}/auth/login`;
  
  // Dùng JSON.stringify nếu API của bạn yêu cầu nhận JSON (Phổ biến ở VN)
  const payload = JSON.stringify({
    email: __ENV.EMAIL || 'qa@example.com',
    password: __ENV.PASSWORD || 'password123',
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, payload, params);

  // Kiểm tra Login có thành công không
  const isOk = check(res, { 'Login thành công (200)': (r) => r.status === 200 });

  // 🛡️ BẢO VỆ: Nếu Login fail, dừng toàn bộ bài test ngay lập tức (Fail-Fast)
  // Tránh việc hàng ngàn VU chạy tiếp gây ra lỗi 401 giả tạo hàng loạt
  if (!isOk) {
    exec.test.abort(`❌ SETUP FAILED: Status ${res.status}. Vui lòng kiểm tra lại tài khoản!`);
  }

  // Trích xuất token và truyền xuống giai đoạn sau
  return { token: res.json('access_token') };
}

export default function (data) {
  // Gom Headers vào một object params để code gọn gàng, dễ quản lý
  const params = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.get(`${BASE_URL}/user/profile`, params);

  // Assertion: Đảm bảo không chỉ status 200 mà dữ liệu trả về phải đúng
  check(res, {
    'Truy cập Profile OK': (r) => r.status === 200,
    'Dữ liệu có chứa tên User': (r) => r.json('name') !== undefined,
  });

  sleep(1);
}
```
**🌟 3 Điểm "Vàng" trong Pattern này:**

_Tính linh hoạt (Environment Variables)_: Bạn có thể thay đổi môi trường test cực nhanh qua Terminal:
k6 run -e BASE_URL=https://staging-api.com -e EMAIL=admin@test.com script.js

_Chiến thuật Fail-Fast_: Sử dụng exec.test.abort() để bảo vệ hệ thống. Nếu không đăng nhập được, k6 sẽ ngừng bắn request ngay lập tức, giúp báo cáo sạch sẽ và không làm nghẽn server vô ích.

_Quản lý tham số chuyên nghiệp_: Thay vì đặt tên biến là headers, ta dùng params. Cách này giúp bạn dễ dàng mở rộng thêm các cấu hình khác của k6 như timeout, tags, hay cookies sau này.
