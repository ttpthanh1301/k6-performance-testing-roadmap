import http from "k6/http";
import { check, sleep } from "k6";

// ==========================================
// 1. INIT STAGE (Khởi tạo máy ảo)
// ==========================================
export const options = {
  vus: 3, // Chạy 3 User ảo
  duration: "3s", // Chạy trong 3 giây
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
      Authorization: `Bearer ${data.authToken}`, // Gắn Token vào Header
      "Content-Type": "application/json",
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
// 4. TEARDOWN STAGE (Chạy 1 lần cuối cùng)
// ==========================================
export function teardown(data) {
  console.log(" [4] TEARDOWN STAGE: Dơn dẹp dữ liệu...");
}