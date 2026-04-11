# 🟠 Phase 3: Chiến lược Test & Phân tích (Realistic Test Design)

> **Mục tiêu bài học:**
> - Phân biệt và làm chủ **5 loại hình kiểm thử hiệu năng** kinh điển
> - Biết cách cấu hình `options` trong k6 để mô phỏng chính xác các kịch bản thực tế
> - Xây dựng quy trình phân tích kết quả bài bản sau khi test
> - Hiểu khi nào nên dùng loại test nào trong dự án thực tế

---

## 🧠 1. Tại sao cần nhiều loại chiến lược Test?

Mỗi hệ thống có một đặc thù riêng:

- Trang **tin tức** → lượng truy cập đều đặn, ổn định cả ngày
- Trang **thương mại điện tử** → có đợt Flash Sale tăng vọt đột ngột
- Hệ thống **ngân hàng** → cần chạy bền bỉ 24/7 không được rò rỉ bộ nhớ

Áp dụng đúng loại hình test giúp bạn tìm ra đúng "bệnh" của hệ thống thay vì chỉ "kiểm tra cho có".

```
Câu hỏi cần trả lời              →  Loại Test phù hợp
──────────────────────────────────────────────────────
Script có chạy đúng không?        →  Smoke Test
Hệ thống có đáp ứng SLA không?   →  Load Test
Giới hạn chịu đựng là bao nhiêu? →  Stress Test
Có chịu được Flash Sale không?    →  Spike Test
Có bị rò rỉ bộ nhớ không?        →  Soak Test
```

---

## 🛠️ 2. Tổng quan 5 loại kịch bản kinh điển

| Loại Test | Mục đích chính | VUs | Thời gian |
|---|---|---|---|
| **Smoke Test** | Kiểm tra script chạy thông suốt | 1–5 | 1–2 phút |
| **Load Test** | Kiểm tra hệ thống ở mức tải kỳ vọng (SLA) | Mức mục tiêu | 20–30 phút |
| **Stress Test** | Tìm "điểm gãy" (Breaking Point) | Vượt mức chịu đựng | 30–60 phút |
| **Spike Test** | Mô phỏng Flash Sale, tải đột biến | Tăng vọt rồi giảm ngay | 5–15 phút |
| **Soak Test** | Tìm rò rỉ bộ nhớ, kiểm tra độ bền | Tải trung bình | Vài giờ đến vài ngày |

---

## 💻 3. Cấu hình k6 cho từng kịch bản

### 3.1. 🟢 Smoke Test — Kiểm tra nhanh trước khi chiến

**Khi nào dùng:** Chạy bắt buộc trước mọi bài test lớn. Phát hiện lỗi logic kịch bản với chi phí thấp nhất.

```javascript
export const options = {
  vus: 3,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate < 0.01'],   // Gần như không được có lỗi
    http_req_duration: ['p(95) < 500'], // Phản hồi dưới 500ms
  },
};
```

> ✅ **Quy tắc:** Nếu Smoke Test FAIL → dừng lại, sửa script trước. Đừng bao giờ chạy Load/Stress Test khi Smoke Test chưa PASS.

---

### 3.2. 🔵 Load Test — Kiểm tra tải tiêu chuẩn (SLA)

**Khi nào dùng:** Kiểm tra hệ thống có đáp ứng được mức tải bình thường cam kết với khách hàng (SLA) không.

```javascript
export const options = {
  stages: [
    { duration: '5m', target: 100 },  // Ramp-up: Tăng dần lên 100 VUs
    { duration: '10m', target: 100 }, // Sustain: Giữ ổn định 100 VUs
    { duration: '5m', target: 0 },    // Ramp-down: Giảm dần về 0
  ],
  thresholds: {
    http_req_duration: ['p(95) < 1000', 'p(99) < 2000'],
    http_req_failed: ['rate < 0.05'],  // Tỉ lệ lỗi dưới 5%
  },
};
```

**Kết quả cần đạt:**
- `p(95) < 1000ms` — 95% request phải phản hồi dưới 1 giây
- Error rate < 5% trong suốt phase Sustain

---

### 3.3. 🔴 Stress Test — Tìm điểm gãy (Breaking Point)

**Khi nào dùng:** Cần biết hệ thống "gãy" ở mức tải nào để lên kế hoạch scale hạ tầng.

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Baseline bình thường
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },  // Tăng mức 1
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },  // Tăng mức 2
    { duration: '5m', target: 300 },
    { duration: '2m', target: 500 },  // Đẩy lên cực hạn
    { duration: '5m', target: 500 },
    { duration: '5m', target: 0 },    // Ramp-down để quan sát hồi phục
  ],
  thresholds: {
    // Không đặt ngưỡng cứng — mục tiêu là quan sát điểm gãy
    http_req_duration: ['p(99) < 5000'],
  },
};
```

> 💡 **Bổ sung — Điều cần quan sát trong Stress Test:**
> - Ở mức tải nào thì `p(95)` bắt đầu tăng vọt?
> - Error rate bắt đầu leo thang từ bao nhiêu VUs?
> - Sau khi dừng test, hệ thống có tự phục hồi không (self-healing)?

---

### 3.4. ⚡ Spike Test — Mô phỏng Flash Sale / Event bất ngờ

**Khi nào dùng:** Trước các sự kiện lớn (Black Friday, ra mắt sản phẩm, livestream có mã giảm giá).

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Nền: Tải bình thường
    { duration: '10s', target: 1000 }, // BÙNG NỔ: Tăng vọt lên 1000 VUs
    { duration: '3m', target: 1000 },  // Duy trì đỉnh
    { duration: '10s', target: 50 },   // Giảm nhiệt đột ngột
    { duration: '2m', target: 50 },    // Quan sát hệ thống hồi phục
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // Trong giai đoạn spike, chấp nhận response chậm hơn
    http_req_duration: ['p(95) < 5000'],
    http_req_failed: ['rate < 0.10'],  // Cho phép lỗi tối đa 10%
  },
};
```

> ⚠️ **Lưu ý thực tế:** Trong Spike Test, mục tiêu không phải là "không có lỗi" mà là hệ thống phải **tự phục hồi** sau khi spike kết thúc. Nếu lỗi kéo dài sau spike — đó là vấn đề nghiêm trọng.

---

### 3.5. 🌙 Soak Test — Kiểm tra độ bền & Memory Leak

**Khi nào dùng:** Phát hiện lỗi chỉ xuất hiện sau thời gian dài: rò rỉ bộ nhớ, connection pool cạn kiệt, log file đầy disk.

```javascript
export const options = {
  stages: [
    { duration: '5m', target: 50 },   // Warm-up
    { duration: '8h', target: 50 },   // Chạy xuyên màn đêm
    { duration: '5m', target: 0 },    // Cool-down
  ],
  thresholds: {
    // Ngưỡng phải ổn định sau 8 tiếng — nếu p(95) tăng dần → Memory Leak
    http_req_duration: ['p(95) < 2000'],
    http_req_failed: ['rate < 0.01'],
  },
};
```

> 💡 **Dấu hiệu Memory Leak khi phân tích Soak Test:**
> - `p(95)` tăng dần theo thời gian dù không thêm VU
> - RAM của server tăng liên tục, không giảm
> - Số lỗi bắt đầu xuất hiện sau vài giờ dù đầu test bình thường

---

## 🔍 4. Quy trình Phân tích sau khi Test

Sau khi chạy xong, hãy trả lời **4 câu hỏi** sau theo thứ tự:

### Câu 1 — Response Time có ổn định không?

```
Chỉ số cần xem: http_req_duration (p50, p95, p99)

✅ Tốt    : p(95) ổn định trong suốt phase Sustain
⚠️ Cảnh báo: p(95) tăng dần theo thời gian (dù VUs không đổi)
❌ Nghiêm trọng: p(99) vượt quá SLA đã cam kết
```

### Câu 2 — Error Rate ở mức nào?

```
Chỉ số cần xem: http_req_failed

✅ Tốt    : < 1% ở Load Test bình thường
⚠️ Cảnh báo: 1–5% — cần điều tra nguyên nhân
❌ Nghiêm trọng: > 5% — hệ thống không đáp ứng được SLA
```

### Câu 3 — Throughput có tuyến tính không?

```
Chỉ số cần xem: http_reqs (RPS — Requests Per Second)

✅ Tốt    : RPS tăng tỉ lệ thuận với VUs (2x VU → ~2x RPS)
⚠️ Cảnh báo: RPS đạt trần dù VUs vẫn tăng → Bottleneck xuất hiện
❌ Nghiêm trọng: RPS giảm khi VUs tăng → Hệ thống đang bị quá tải
```

### Câu 4 — Tài nguyên server có hồi phục không? *(Soak Test)*

```
Chỉ số cần xem: RAM, CPU, Connection Pool (theo dõi ngoài k6)

✅ Tốt    : RAM/CPU trở về mức nền sau khi dừng test
⚠️ Cảnh báo: RAM cao nhưng giảm chậm
❌ Nghiêm trọng: RAM tăng liên tục, không giảm → Memory Leak
```

---

## 📊 5. Bổ sung — Executor nâng cao (Thay thế `stages`)

> 💡 Ngoài cách dùng `stages` đơn giản, k6 còn hỗ trợ **Executors** — cho phép kiểm soát VUs chính xác hơn. Đây là tính năng mạnh mẽ dành cho kịch bản phức tạp.

| Executor | Dùng khi |
|---|---|
| `constant-vus` | Giữ cố định N VUs trong X giây |
| `ramping-vus` | Tương đương `stages` — tăng/giảm VUs theo thời gian |
| `constant-arrival-rate` | Đảm bảo đúng N request/giây bất kể VUs |
| `ramping-arrival-rate` | Tăng dần RPS theo thời gian |
| `per-vu-iterations` | Mỗi VU chạy đúng N vòng lặp |

```javascript
// Ví dụ: Đảm bảo đúng 100 request/giây (không phụ thuộc vào số VUs)
export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: 100,            // 100 request/giây
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,  // Khởi tạo sẵn 50 VUs
      maxVUs: 200,          // Tối đa 200 VUs nếu cần
    },
  },
};
```

> **Tại sao cần `constant-arrival-rate`?** Với `ramping-vus`, mỗi VU gửi request xong mới gửi tiếp — nếu server chậm, RPS tự động giảm. `constant-arrival-rate` đảm bảo RPS cố định dù server chậm, mô phỏng thực tế hơn.

---

## 📝 6. Quy tắc vàng của Phase 3

```
1. LUÔN chạy Smoke Test trước
   └─ Script lỗi logic → dừng, sửa ngay. Không chạy Load Test khi Smoke Test chưa PASS.

2. LUÔN có Ramp-up
   └─ Tăng tải dần dần cho hệ thống có thời gian warm-up, tránh kết quả bị sai lệch.

3. LUÔN có Ramp-down
   └─ Quan sát hệ thống hồi phục sau khi giảm tải — đây cũng là dữ liệu quan trọng.

4. LUÔN đặt Thresholds
   └─ Không có ngưỡng = không có tiêu chí Pass/Fail = bài test vô nghĩa.

5. Soak Test là bài test "tố cáo" nguy hiểm nhất
   └─ Các lỗi tiềm ẩn như Memory Leak chỉ lộ diện sau nhiều giờ chạy liên tục.
```

---

## 🗺️ 7. Lộ trình thực hành khuyến nghị

```
Tuần 1 — Nền tảng
├─ Chạy Smoke Test cho mọi script mới viết
└─ Chạy Load Test cơ bản với stages 3 giai đoạn (ramp-up / sustain / ramp-down)

Tuần 2 — Nâng cao
├─ Chạy Stress Test, xác định Breaking Point của hệ thống
└─ Chạy Spike Test trước các sự kiện lớn

Tuần 3 — Chuyên sâu
├─ Chạy Soak Test qua đêm, theo dõi RAM/CPU song song
└─ Thử nghiệm Executors nâng cao (constant-arrival-rate)
```

---

## 📚 8. Nguồn tham khảo

- [k6 Docs: Test Types](https://grafana.com/docs/k6/latest/testing-guides/test-types/)
- [k6 Docs: Scenarios & Executors](https://grafana.com/docs/k6/latest/using-k6/scenarios/)
- [k6 Docs: Ramping VUs](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/)
- [k6 Docs: Constant Arrival Rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/)
- [Performance Testing Guide — Google SRE Book](https://sre.google/sre-book/testing-reliability/)