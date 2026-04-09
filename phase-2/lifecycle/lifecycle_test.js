import http from "k6/http";
import { check, sleep } from "k6";

// ==========================================
// 1. INIT STAGE (Khởi tạo máy ảo)
// ==========================================
export const options = {
  vus: 10,
  duration: "5s",
};
// Đọc file tĩnh ở đây: const myData = JSON.parse(open('./data.json'));

// ==========================================
// 2. SETUP STAGE (Chạy 1 lần duy nhất)
// ==========================================
export function setup() {
  console.log("--- [SETUP]: Đang lấy Token ---");

  // Giả lập gọi API lấy Token
  const loginRes = http.get("https://test-api.k6.io/public/crocodiles/1/");

  // Trích xuất dữ liệu (Giả sử đây là Token an toàn)
  const fakeToken = "Bearer my-super-secret-token";

  // Return một object chứa dữ liệu để chia sẻ cho toàn bộ VUs
  return { authToken: fakeToken, crocId: 1 };
}

// ==========================================
// 3. VU STAGE (Chạy lặp đi lặp lại bởi nhiều VUs)
// ==========================================
export default function (data) {
  // Nhận 'data' từ kết quả return của setup()
  const params = {
    headers: { Authorization: data.authToken },
  };

  // 10 VUs đều dùng chung Token mà không cần phải Login lại
  const res = http.get(
    `https://test-api.k6.io/public/crocodiles/${data.crocId}/`,
    params,
  );

  check(res, {
    "Status là 200": (r) => r.status === 200,
  });

  sleep(1); // Giả lập người dùng đọc trang trong 1s
}

// ==========================================
// 4. TEARDOWN STAGE (Chạy 1 lần duy nhất)
// ==========================================
export function teardown(data) {
  console.log("--- [TEARDOWN]: Dọn dẹp dữ liệu ---");
  // Dùng lại data từ setup để biết cần xóa cái gì
  // http.del(`https://test-api.k6.io/public/crocodiles/${data.crocId}/`, null, { headers: { 'Authorization': data.authToken } });
}
