import http from "k6/http";
import { sleep } from "k6";

// Kịch bản chính: Hàm default sẽ được k6 gọi liên tục
export default function () {
  // Gửi một request GET đến một API test của k6
  http.get("https://test.k6.io");

  // Tạm nghỉ 1 giây trước khi vòng lặp tiếp theo bắt đầu (Giả lập thao tác người dùng)
  sleep(1);
}