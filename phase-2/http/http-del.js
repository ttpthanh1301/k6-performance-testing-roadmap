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

  console.log(
    `🔑 Đã lấy Token cho lệnh DELETE: ${realToken.substring(0, 15)}...`,
  );

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
      Authorization: `Bearer ${token}`,
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
