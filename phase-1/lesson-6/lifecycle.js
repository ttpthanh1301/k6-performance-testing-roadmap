import http from "k6/http";
import { sleep } from "k6";

// ==========================================
// [1] INIT STAGE (Chạy đầu tiên)
// ==========================================
console.log(" [1] INIT STAGE: Đang khởi tạo script...");
export const options = { vus: 2, iterations: 4 };

// ==========================================
// [2] SETUP STAGE (Chạy 1 lần)
// ==========================================
export function setup() {
  console.log(" [2] SETUP STAGE: Lấy Token Login...");
  return { authToken: "secret-token-123" }; // Truyền data xuống VU stage
}

// ==========================================
// [3] VU STAGE (Chạy lặp lại liên tục)
// ==========================================
export default function (data) {
  console.log(
    ` [3] VU STAGE (User ${__VU}): Đang dùng token: ${data.authToken}`,
  );
  http.get("https://test.k6.io");
  sleep(1);
}

// =========================================`=
// [4] TEARDOWN STAGE (Chạy 1 lần cuối cùng)
// ==========================================
export function teardown(data) {
  console.log(" [4] TEARDOWN STAGE: Dọn dẹp dữ liệu...");
}
