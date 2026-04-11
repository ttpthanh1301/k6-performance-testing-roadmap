# 🧪 Bài 3.1: Các loại Test — Smoke / Load / Stress / Spike / Soak

> **Mục tiêu bài học:**
>
> - Phân biệt **5 loại hình kiểm thử hiệu năng** kinh điển và biết khi nào dùng loại nào
> - Hiểu cấu trúc `stages` và cách mô phỏng từng kịch bản tải
> - Nắm được các chỉ số cần quan sát cho từng loại test
>
> **Lưu ý về lộ trình:**
>
> - Bài này tập trung vào **tư duy chiến lược** và cấu hình cơ bản với `stages`
> - **Executors nâng cao** (thay thế `stages`) → học ở **Bài 3.2**
> - **Thresholds chi tiết** (SLO / Pass-Fail) → học ở **Bài 3.3**
> - **Custom Metrics** → học ở **Bài 3.4**

---

## 🧠 1. Tại sao cần nhiều loại chiến lược Test?

Một câu hỏi phổ biến của người mới: _"Cứ chạy nhiều VU nhất có thể không phải tốt nhất sao?"_

**Không.** Mỗi loại lỗi hiệu năng cần một loại test khác nhau để phát hiện:

```
Vấn đề cần tìm                        →  Loại Test phù hợp
──────────────────────────────────────────────────────────
Script có chạy đúng logic không?       →  Smoke Test
Hệ thống có đáp ứng SLA không?        →  Load Test
Giới hạn chịu đựng tối đa là bao nhiêu? →  Stress Test
Có chịu được Flash Sale đột ngột không? →  Spike Test
Có bị rò rỉ bộ nhớ sau vài giờ không? →  Soak Test
```

**Ví dụ thực tế:**

- Trang **tin tức** → lượng truy cập đều đặn → cần Load Test + Soak Test
- Sàn **thương mại điện tử** → Flash Sale bất ngờ → cần Spike Test
- Hệ thống **ngân hàng** → chạy 24/7 không được sập → cần Stress Test + Soak Test

---

## 📊 2. Tổng quan 5 loại Test

| Loại Test     | Mục đích chính                     | VUs            | Thời gian chạy     |
| ------------- | ---------------------------------- | -------------- | ------------------ |
| 🟢 **Smoke**  | Xác nhận script chạy đúng          | 1–5            | 1–2 phút           |
| 🔵 **Load**   | Kiểm tra hệ thống ở mức tải SLA    | Mức mục tiêu   | 20–30 phút         |
| 🔴 **Stress** | Tìm điểm gãy (Breaking Point)      | Vượt mức SLA   | 30–60 phút         |
| ⚡ **Spike**  | Mô phỏng tải đột biến (Flash Sale) | Tăng vọt nhanh | 10–20 phút         |
| 🌙 **Soak**   | Tìm rò rỉ bộ nhớ, kiểm tra độ bền  | Tải trung bình | Vài giờ – vài ngày |

---

## 💻 3. Cấu hình từng loại Test

> 💡 **Ghi chú:** Các ví dụ dưới đây dùng `stages` — cách đơn giản và trực quan nhất để bắt đầu. Bài **3.2 Executors & Scenarios** sẽ dạy cách kiểm soát chính xác và linh hoạt hơn.

---

### 3.1. 🟢 Smoke Test — "Khởi động trước khi chiến"

**Mục đích:** Kiểm tra script có chạy đúng logic không với tải tối thiểu. Phát hiện lỗi code rẻ nhất có thể.

**Quy tắc bắt buộc:** Luôn chạy Smoke Test **trước mọi bài test khác**.

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 3, // Chỉ 3 VU — đủ để kiểm tra logic, không tạo tải thật
  duration: "1m", // Chạy 1 phút là đủ
  thresholds: {
    http_req_failed: ["rate < 0.01"], // Gần như không được có lỗi
    http_req_duration: ["p(95) < 500"], // Phản hồi dưới 500ms
  },
};

export default function () {
  const res = http.get("https://api.example.com/products");

  check(res, {
    "status 200": (r) => r.status === 200,
    "body không rỗng": (r) => r.body.length > 0,
    "có trường data": (r) => r.json().data !== undefined,
  });

  sleep(1);
}
```

**Smoke Test PASS khi:**

- ✅ Tất cả `check()` đều xanh
- ✅ Không có lỗi HTTP (4xx, 5xx)
- ✅ Logic Correlation (lấy token, parse JSON) hoạt động đúng

> ❌ **Smoke Test FAIL → DỪNG LẠI.** Không bao giờ chạy Load/Stress Test khi Smoke Test chưa PASS. Bạn sẽ lãng phí hàng giờ test với một script bị hỏng.

---

### 3.2. 🔵 Load Test — "Kiểm tra đúng cam kết SLA"

**Mục đích:** Xác nhận hệ thống hoạt động ổn định ở mức tải bình thường đã cam kết với khách hàng.

**Cấu trúc 3 giai đoạn bắt buộc:**

```
Ramp-up   →  Sustain  →  Ramp-down
(tăng dần)   (giữ ổn định)  (giảm dần)
```

```javascript
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "5m", target: 100 }, // Ramp-up: tăng dần lên 100 VUs
    { duration: "10m", target: 100 }, // Sustain: giữ ổn định 100 VUs
    { duration: "5m", target: 0 }, // Ramp-down: giảm về 0
  ],
  thresholds: {
    http_req_duration: ["p(95) < 1000", "p(99) < 2000"],
    http_req_failed: ["rate < 0.05"],
  },
};

export default function () {
  http.get("https://api.example.com/products");
  sleep(1);
}
```

**Timeline:**

```
VUs
100 │         ┌──────────────┐
    │        /               \
 50 │       /                 \
    │      /                   \
  0 └──────────────────────────────── Thời gian
    0    5m      15m           20m
         ↑        ↑             ↑
      Ramp-up  Sustain      Ramp-down
```

**Câu hỏi Load Test cần trả lời:**

- `p(95)` có nằm dưới ngưỡng SLA suốt phase Sustain không?
- Error rate có dưới 5% không?
- RPS có ổn định không hay dao động bất thường?

> 💡 **Tại sao cần Ramp-up?** Nếu đẩy 100 VU ngay lập tức, server bị "sốc tải" — connection pool chưa kịp khởi tạo, cache chưa warm-up → kết quả bị sai lệch. Ramp-up cho hệ thống thời gian "khởi động" như trong thực tế.

---

### 3.3. 🔴 Stress Test — "Tìm điểm gãy"

**Mục đích:** Đẩy hệ thống vượt qua giới hạn bình thường để biết **ở mức tải nào thì bắt đầu gãy** — từ đó lên kế hoạch scale hạ tầng.

```javascript
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    // Giai đoạn 1: Baseline bình thường
    { duration: "2m", target: 100 },
    { duration: "5m", target: 100 },

    // Giai đoạn 2: Tăng dần từng bước
    { duration: "2m", target: 200 },
    { duration: "5m", target: 200 },

    { duration: "2m", target: 300 },
    { duration: "5m", target: 300 },

    // Giai đoạn 3: Đẩy lên cực hạn
    { duration: "2m", target: 500 },
    { duration: "5m", target: 500 },

    // Giai đoạn 4: Ramp-down — quan sát hệ thống có tự hồi phục không
    { duration: "5m", target: 0 },
  ],
  thresholds: {
    // Mục tiêu là quan sát điểm gãy — không đặt ngưỡng quá cứng
    http_req_duration: ["p(99) < 5000"],
  },
};

export default function () {
  http.get("https://api.example.com/products");
  sleep(1);
}
```

**Timeline:**

```
VUs
500 │                              ┌────────┐
300 │               ┌────────┐    /         \
200 │      ┌─────┐ /         \  /            \
100 │ ┌──┐/       /           \/              \
    └─────────────────────────────────────────── Thời gian
                                                  (30 phút)
```

**3 điều cần ghi lại sau Stress Test:**

| Điều cần ghi lại               | Ý nghĩa                     |
| ------------------------------ | --------------------------- |
| VU bắt đầu có lỗi              | Breaking Point của hệ thống |
| VU mà `p(95)` tăng vọt         | Điểm bắt đầu degradation    |
| Thời gian hệ thống tự hồi phục | Khả năng self-healing       |

> ⚠️ **Không nên đặt Threshold cứng cho Stress Test.** Mục tiêu là **quan sát**, không phải Pass/Fail. Nếu đặt ngưỡng và test FAIL ngay từ đầu, bạn không thu thập được dữ liệu về điểm gãy.

---

### 3.4. ⚡ Spike Test — "Mô phỏng Flash Sale"

**Mục đích:** Kiểm tra hệ thống có sống sót qua đợt tải tăng vọt **đột ngột** không, và có tự phục hồi sau đó không.

**Thực tế cần mô phỏng:** Người dùng ùa vào trong vài giây khi Flash Sale bắt đầu, rồi giảm nhanh sau đó.

```javascript
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 50 }, // Nền: Tải bình thường
    { duration: "10s", target: 1000 }, // ⚡ BÙN NỔ: tăng vọt lên 1000 VUs trong 10 giây
    { duration: "3m", target: 1000 }, // Duy trì đỉnh
    { duration: "10s", target: 50 }, // Giảm nhiệt đột ngột
    { duration: "3m", target: 50 }, // ← Quan sát hệ thống hồi phục về mức nền
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95) < 5000"], // Chấp nhận chậm hơn trong spike
    http_req_failed: ["rate < 0.10"], // Cho phép lỗi tối đa 10% lúc đỉnh
  },
};

export default function () {
  http.get("https://api.example.com/products");
  sleep(1);
}
```

**Timeline:**

```
VUs
1000│        ┌──────┐
    │        |      |
    │       /        \
 50 │──────/          \──────────
    └──────────────────────────── Thời gian
    0   2m   2m10s  5m10s  5m20s  8m20s
              ↑                ↑
           Spike           Phục hồi
```

**Spike Test PASS khi:**

- ✅ Hệ thống không sập hoàn toàn trong lúc spike
- ✅ Sau khi spike kết thúc, error rate trở về < 1% trong vòng 2-3 phút
- ✅ `p(95)` trở về mức bình thường sau khi giảm tải

> ⚠️ **Lỗi kéo dài sau spike = vấn đề nghiêm trọng.** Đây là dấu hiệu hệ thống không có khả năng tự phục hồi (no self-healing) — cần xem lại connection pool, auto-scaling, circuit breaker.

---

### 3.5. 🌙 Soak Test — "Kiểm tra độ bền"

**Mục đích:** Phát hiện các lỗi **chỉ xuất hiện sau thời gian dài** mà các loại test ngắn không thể tìm thấy.

**Loại lỗi Soak Test tìm được:**

| Lỗi                          | Biểu hiện                       |
| ---------------------------- | ------------------------------- |
| **Memory Leak**              | RAM tăng liên tục, không giảm   |
| **Connection Pool cạn kiệt** | Lỗi tăng dần sau vài giờ        |
| **Log file đầy disk**        | Lỗi ghi file sau N giờ          |
| **Session / Token expire**   | Lỗi auth sau thời gian dài      |
| **Database connection leak** | Timeout tăng dần theo thời gian |

```javascript
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "5m", target: 50 }, // Warm-up nhẹ nhàng
    { duration: "8h", target: 50 }, // Duy trì 50 VU xuyên suốt — chạy qua đêm
    { duration: "5m", target: 0 }, // Cool-down
  ],
  thresholds: {
    // Ngưỡng PHẢI ổn định sau 8 tiếng
    // Nếu p(95) tăng dần dù VU không đổi → Memory Leak
    http_req_duration: ["p(95) < 2000"],
    http_req_failed: ["rate < 0.01"],
  },
};

export default function () {
  http.get("https://api.example.com/products");
  sleep(1);
}
```

**Cách đọc kết quả Soak Test:**

```
p(95) theo thời gian:

✅ Hệ thống ổn định:
200ms ─────────────────────────────────── (phẳng)

⚠️ Memory Leak:
      200ms ──────────/─────────/────────/ (tăng dần)

❌ Nghiêm trọng — Connection Pool cạn:
      200ms ──────────────────────────╱ (tăng vọt đột ngột sau N giờ)
```

> 💡 **Mẹo thực tế:** Chạy Soak Test vào **tối thứ Sáu** — sáng thứ Hai có kết quả 60 tiếng. Dùng Grafana Dashboard (học ở Bài 3.5) để theo dõi real-time và nhận alert nếu có bất thường.

---

## 🔄 4. Quy trình thực hành — Chạy theo đúng thứ tự này

```
Bước 1 ─ Smoke Test (1–2 phút)
    └─ Script PASS? → Tiếp tục
    └─ Script FAIL? → Dừng, sửa script

Bước 2 ─ Load Test (20–30 phút)
    └─ SLA đạt? → Tiếp tục
    └─ SLA không đạt? → Tìm bottleneck (Bài 3.5), tối ưu rồi test lại

Bước 3 ─ Stress Test (30–60 phút)
    └─ Ghi lại Breaking Point
    └─ Lên kế hoạch scale hạ tầng

Bước 4 ─ Spike Test (10–20 phút)
    └─ Chạy trước các sự kiện lớn (Black Friday, ra mắt tính năng)

Bước 5 ─ Soak Test (8–72 tiếng)
    └─ Chạy qua đêm / cuối tuần
    └─ Theo dõi RAM/CPU song song với k6
```

---

## ⚖️ 5. So sánh nhanh để không nhầm lẫn

|                          | Smoke | Load | Stress |     Spike     | Soak |
| ------------------------ | :---: | :--: | :----: | :-----------: | :--: |
| VU ít                    |  ✅   |      |        |               |      |
| VU bình thường           |       |  ✅  |        |               |  ✅  |
| VU nhiều                 |       |      |   ✅   | ✅ (đột ngột) |      |
| Thời gian ngắn           |  ✅   |      |        |      ✅       |      |
| Thời gian dài            |       |      |        |               |  ✅  |
| Tìm lỗi logic script     |  ✅   |      |        |               |      |
| Tìm lỗi SLA              |       |  ✅  |        |               |      |
| Tìm Breaking Point       |       |      |   ✅   |               |      |
| Tìm Memory Leak          |       |      |        |               |  ✅  |
| Tìm khả năng tự hồi phục |       |      |   ✅   |      ✅       |      |

---

## 📝 6. Quy tắc vàng

```
1. LUÔN chạy Smoke Test trước
   └─ Mọi bài test khác đều vô nghĩa nếu script có lỗi logic.

2. LUÔN có Ramp-up và Ramp-down
   └─ Tránh "sốc tải" khi bắt đầu — quan sát hồi phục khi kết thúc.

3. LUÔN có Thresholds (học kỹ ở Bài 3.3)
   └─ Không có ngưỡng = không có tiêu chí PASS/FAIL = test vô nghĩa.

4. Không nhầm mục đích từng loại test
   └─ Stress Test để tìm điểm gãy — không phải để "PASS".
   └─ Soak Test để tìm Memory Leak — không phải Load Test kéo dài.
```

---

## 🔗 7. Kết nối với các bài tiếp theo

| Bài                           | Nội dung                                                                  | Liên quan                                       |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| **3.2 Executors & Scenarios** | Thay `stages` bằng Executors chính xác hơn, chạy nhiều kịch bản song song | Nâng cấp cách cấu hình bài này                  |
| **3.3 Thresholds**            | Đặt ngưỡng SLO chuyên nghiệp, tích hợp CI/CD PASS/FAIL                    | Làm cho từng loại test trên có tiêu chí rõ ràng |
| **3.4 Custom Metrics**        | Đo lường logic nghiệp vụ (tỉ lệ checkout thành công...)                   | Bổ sung chỉ số cho Soak/Load Test               |
| **3.5 Grafana Dashboard**     | Visualize kết quả real-time, xác định Bottleneck                          | Phân tích kết quả các bài test trên             |

---

## 📚 8. Nguồn tham khảo

- [k6 Docs: Test Types Overview](https://grafana.com/docs/k6/latest/testing-guides/test-types/)
- [k6 Docs: Smoke Testing](https://grafana.com/docs/k6/latest/testing-guides/test-types/smoke-testing/)
- [k6 Docs: Load Testing](https://grafana.com/docs/k6/latest/testing-guides/test-types/load-testing/)
- [k6 Docs: Stress Testing](https://grafana.com/docs/k6/latest/testing-guides/test-types/stress-testing/)
- [k6 Docs: Spike Testing](https://grafana.com/docs/k6/latest/testing-guides/test-types/spike-testing/)
- [k6 Docs: Soak Testing](https://grafana.com/docs/k6/latest/testing-guides/test-types/soak-testing/)
