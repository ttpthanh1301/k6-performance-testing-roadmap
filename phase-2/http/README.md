## 🌐 Bài 2.3: HTTP Mastery (Làm chủ GET, POST, Headers và Params)

> **Mục tiêu bài học:** Nắm vững cách sử dụng module `k6/http` để mô phỏng mọi loại tương tác của người dùng với server. Biết cách gửi dữ liệu JSON (POST), cấu hình bảo mật (Headers - Bearer Token) và truyền tham số (Query Params) một cách chuẩn xác.

---

### 📦 1. Import module k6/http

Để bắt đầu gọi API, bạn luôn phải gọi thư viện HTTP tích hợp sẵn của k6 ở đầu file:

````javascript
import http from "k6/http";
### 📦 1. Import module k6/http

Để bắt đầu gọi API, bạn luôn phải gọi thư viện HTTP tích hợp sẵn của k6 ở đầu file:

```javascript
import http from "k6/http";
````

### 📥 2. Gọi API cơ bản với http.get()

Đây là phương thức phổ biến nhất để giả lập hành vi người dùng truy cập web hoặc lấy danh sách dữ liệu.

```javascript
import http from "k6/http";
import { sleep } from "k6";

export default function () {
  // 1. GET cơ bản: Lấy danh sách bài viết
  http.get("[https://dummyjson.com/posts](https://dummyjson.com/posts)");

  // 2. GET với Query Parameters (Thêm ?key=value)
  // Lấy 5 bài viết, bỏ qua 10 bài đầu tiên
  const limit = 5;
  const skip = 10;
  http.get(`https://dummyjson.com/posts?limit=${limit}&skip=${skip}`);

  sleep(1);
}
```

### 📤 3. Gửi dữ liệu với http.post() (Tuyệt chiêu JSON)

Khi giả lập hành vi Đăng nhập, Đăng ký, hay Thêm vào giỏ hàng, bạn bắt buộc phải dùng POST.

**🚨 Lỗi chết người thường gặp**: Rất nhiều bạn truyền thẳng object JavaScript vào hàm POST. Trong k6, bạn **BẮT BUỘC** phải biến object đó thành chuỗi JSON (dùng JSON.stringify) và cấu hình Header Content-Type.
import http from 'k6/http';

```bash
import http from "k6/http";
import { check, sleep } from "k6";

// ==========================================
// 1. SETUP: Tự động đăng nhập lấy Token
// ==========================================
export function setup() {
  const loginUrl = "https://dummyjson.com/auth/login";

  // Dùng tài khoản test mặc định của hệ thống DummyJSON
  const payload = JSON.stringify({
    username: "emilys",
    password: "emilyspass",
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  // Gửi POST request để đăng nhập
  const loginRes = http.post(loginUrl, payload, params);

  // Trích xuất Token từ cục JSON trả về
  const realToken = loginRes.json("token");

  console.log(`🔑 Đã lấy Token: ${realToken.substring(0, 15)}...`);

  // Return token để chia sẻ cho các User Ảo (VUs)
  return { token: realToken };
}

// ==========================================
// 2. VU STAGE: Sử dụng Token để gọi API bảo mật
// ==========================================
export default function (data) {
  // Lấy token được truyền xuống từ hàm setup()
  const token = data.token;

  const params = {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,   // Gắn Token thật vào đây
      "User-Agent": "k6-Load-Test-Bot/1.0",
    },
    timeout: "10s",
  };

  // Gọi API lấy thông tin user đang đăng nhập
  const res = http.get("https://dummyjson.com/auth/me", params);

  // Kiểm tra xem server có chấp nhận Token và trả về Status 200 không
  check(res, {
    "Truy cập thành công (Status 200)": (r) => r.status === 200,
  });

  sleep(1);
}
```

### 🛠 4. Làm chủ Params object (Headers, Cookies, Tags)

Hàm HTTP nào trong k6 (GET, POST, PUT, DELETE) cũng có thể nhận một object params ở tham số cuối cùng. Đây là nơi bạn cấu hình mọi thứ liên quan đến metadata của request.

**Cấu hình Authorization (Kèm Token bảo mật)**

Khi test các API yêu cầu đăng nhập, bạn phải gắn Access Token vào Headers.

```javascript
const params = {
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`, // Gắn Token thật vào đây
    "User-Agent": "k6-Load-Test-Bot/1.0",
  },
  timeout: "10s",
};
```

### ⚡ 5. Bí kíp nâng cao: http.batch() (Gửi song song)

Trong thực tế, khi người dùng mở 1 trang web, trình duyệt không tải từng ảnh một. Nó tải **nhiều file cùng một lúc (song song)**. Để giả lập chính xác hành vi này, k6 cung cấp hàm `http.batch()`.

```javascript
import http from "k6/http";
import { sleep } from "k6";

export default function () {
  // Gửi 3 requests cùng MỘT LÚC (Parallel).
  // k6 sẽ đợi cả 3 trả về kết quả rồi mới đi tiếp.
  const responses = http.batch([
    ["GET", "https://dummyjson.com/posts/1"],
    ["GET", "https://dummyjson.com/posts/2"],
    ["GET", "https://dummyjson.com/posts/3"],
  ]);

  // Bạn có thể truy cập kết quả của từng request
  console.log(`Bài viết 1 load status: ${responses[0].status}`);
  console.log(`Bài viết 2 load status: ${responses[1].status}`);

  sleep(1);
}
```

--
💡 Ứng dụng: `http.batch()` đặc biệt hữu ích khi test tải các trang web Frontend (SSR/SPA) hoặc test các hệ thống Microservices cần tổng hợp data từ nhiều nguồn cùng lúc.

### 🔄 6. Cập nhật dữ liệu với `http.put()` (Update)

Khi bạn muốn giả lập hành vi người dùng cập nhật thông tin cá nhân (đổi tên, đổi mật khẩu) hoặc sửa một bản ghi đã có, bạn sẽ dùng phương thức `PUT` (hoặc `PATCH`).

Cú pháp của `PUT` **giống hệt 100%** với `POST`. Bạn cũng cần phải có dữ liệu (Payload) và ép kiểu sang chuỗi JSON.

**Code chuẩn:**

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

// ==========================================
// 1. SETUP: Tự động đăng nhập lấy Token
// ==========================================
export function setup() {
  const loginUrl = "https://dummyjson.com/auth/login";

  // Dùng tài khoản test mặc định của hệ thống
  const payload = JSON.stringify({
    username: "emilys",
    password: "emilyspass",
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const loginRes = http.post(loginUrl, payload, params);
  const realToken = loginRes.json("token");

  console.log(`🔑 Đã lấy Token cho lệnh PUT: ${realToken.substring(0, 15)}...`);

  return { token: realToken };
}

// ==========================================
// 2. VU STAGE: Gửi lệnh Cập nhật (PUT)
// ==========================================
export default function (data) {
  const token = data.token; // Rút token từ Setup
  const postId = 1; // ID của bài viết cần sửa
  const url = `https://dummyjson.com/posts/${postId}`;

  // Chuẩn bị dữ liệu cập nhật
  const payload = JSON.stringify({
    title: "Tiêu đề đã được cập nhật tự động bằng k6",
  });

  // Gắn Token vào Header
  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  // Thực thi PUT
  const res = http.put(url, payload, params);

  // Kiểm tra xem cập nhật có thành công không
  check(res, {
    "Cập nhật bài viết thành công (Status 200)": (r) => r.status === 200,
  });

  console.log(`PUT status: ${res.status}`);
  sleep(1);
}
```

### 🗑️ 7. Xóa dữ liệu với http.del() (Delete)

Để giả lập việc xóa một bài viết, hủy đơn hàng, hoặc xóa tài khoản, chúng ta dùng phương thức Delete.

**🚨 KIẾN THỨC BẮT BUỘC NHỚ**: Trong k6, bạn không dùng hàm`http.delete()` vì chữ `delete` là một từ khóa bị cấm (reserved keyword) trong JavaScript. Thay vào đó, k6 sử dụng hàm `http.del()`.

Thường thì hàm xóa chỉ cần URL chứa ID và Header xác thực, không cần truyền Payload (body).

```bash
import http from "k6/http";
import { check, sleep } from "k6";

// ==========================================
// 1. SETUP: Tự động đăng nhập lấy Token
// ==========================================
export function setup() {
  const loginUrl = "https://dummyjson.com/auth/login";

  // Dùng tài khoản test mặc định của hệ thống
  const payload = JSON.stringify({
    username: "emilys",
    password: "emilyspass",
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const loginRes = http.post(loginUrl, payload, params);
  const realToken = loginRes.json("token");

  console.log(`🔑 Đã lấy Token cho lệnh DELETE: ${realToken.substring(0, 15)}...`);

  return { token: realToken };
}

// ==========================================
// 2. VU STAGE: Gửi lệnh Xóa (DELETE)
// ==========================================
export default function (data) {
  const token = data.token; // Rút token từ Setup
  const postId = 1; // ID của bài viết cần xóa
  const url = `https://dummyjson.com/posts/${postId}`;

  // Gắn Token vào Header (Không cần Content-Type vì không có body)
  const params = {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  };

  // Cú pháp: http.del(url, body, params)
  // Lệnh xóa không cần payload nên tham số thứ 2 để là `null`
  const res = http.del(url, null, params);

  // Kiểm tra xem xóa có thành công không
  check(res, {
    "Xóa bài viết thành công (Status 200)": (r) => r.status === 200,
  });

  console.log(`DELETE status: ${res.status}`);
  sleep(1);
}
```

--
**📝 Tóm tắt quy tắc vàng cho hệ sinh thái HTTP trong k6**:
Giao tiếp cơ bản: http.get(url, params)

Thêm mới dữ liệu: http.post(url, payload, params)

Cập nhật dữ liệu: http.put(url, payload, params) hoặc http.patch()

Xóa dữ liệu: Dùng http.del(url, null, params) chứ không phải delete.

Nếu payload là JSON, TUYỆT ĐỐI không quên JSON.stringify(payload) và gán header 'Content-Type': 'application/json'.
[Tài liệu tham khảo](https://www.mintlify.com/grafana/k6/writing-tests/http-requests#multipart-form)
viết lại cho tôi bài này
