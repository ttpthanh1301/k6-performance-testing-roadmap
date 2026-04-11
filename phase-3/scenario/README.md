# ⚙️ Bài 3.2: Executors & Scenarios — Điều phối "Đội quân" VU chuyên nghiệp

> **Mục tiêu bài học:**
> - Hiểu sự khác biệt giữa **Scenarios** và cách cấu hình `stages` đơn giản
> - Nắm vững **7 loại Executor** và biết khi nào dùng loại nào
> - Phân biệt **Closed Model** vs **Open Model** — nền tảng lý thuyết quan trọng
> - Kết hợp nhiều Scenarios chạy song song trong cùng một bài test
> - Sử dụng `k6/execution` để truy xuất thông tin ngữ cảnh đang chạy

---

## 🧠 1. Vì sao `stages` chưa đủ — Cần Scenarios & Executors?

Với cách cấu hình `stages` đơn giản, toàn bộ script chỉ chạy **một kịch bản duy nhất**:

```javascript
// ❌ Giới hạn của stages — chỉ kiểm soát được số VU theo thời gian
export const options = {
  stages: [
    { duration: '5m', target: 100 },
    { duration: '10m', target: 100 },
    { duration: '5m', target: 0 },
  ],
};
```

**Vấn đề thực tế:** Một hệ thống e-commerce có nhiều luồng người dùng cùng lúc:
- 🧑‍💻 **1000 người** đang browse sản phẩm (đọc nhẹ)
- 🛒 **200 người** đang thêm vào giỏ hàng
- 💳 **50 người** đang thanh toán (ghi nặng)

Với `stages`, bạn không thể mô phỏng 3 luồng này **đồng thời với tỉ lệ khác nhau**.

**Giải pháp: Scenarios + Executors**

```
Scenarios = Kịch bản (WHAT to do)    → Định nghĩa luồng người dùng
Executors  = Động cơ  (HOW to run)   → Điều phối VU và iteration
```

---

## 📐 2. Closed Model vs Open Model — Nền tảng lý thuyết

Đây là khái niệm quan trọng nhất trước khi học Executor.

### Closed Model (Mô hình đóng)

```
VU bắt đầu → Chạy iteration → Chờ sleep() → Chạy tiếp...
               ↑_____________________________________|
                    Vòng lặp khép kín

Đặc điểm: Số VU cố định. Nếu server chậm → iteration chậm → RPS tự giảm.
```

> ⚠️ **Vấn đề Coordinated Omission:** Khi server chậm lại, các VU cũng chậm lại theo → RPS giảm → test tự "nhẹ tay" với server đúng lúc server yếu nhất. Đây là kết quả **bị sai lệch so với thực tế**.

**Executors thuộc Closed Model:**
- `shared-iterations`
- `per-vu-iterations`
- `constant-vus`
- `ramping-vus`

### Open Model (Mô hình mở)

```
Giây 1: ──→ [Iteration] [Iteration] [Iteration]
Giây 2: ──→ [Iteration] [Iteration] [Iteration]
Giây 3: ──→ [Iteration] [Iteration] [Iteration]
              ↑ Iteration mới khởi động KHÔNG PHỤ THUỘC vào server chậm hay nhanh
```

> ✅ **Mô phỏng thực tế hơn:** Người dùng thực tế sẽ không "chờ nhau" — họ vẫn vào website dù server đang chậm.

**Executors thuộc Open Model:**
- `constant-arrival-rate`
- `ramping-arrival-rate`

---

## 🔧 3. Chi tiết 7 loại Executor

### Tổng quan nhanh

| Executor | Model | Đơn vị kiểm soát | Dùng khi |
|---|---|---|---|
| `shared-iterations` | Closed | Tổng số iteration | Cần chạy đúng X iteration, không quan tâm VU nào chạy |
| `per-vu-iterations` | Closed | Iteration/VU | Mỗi VU cần chạy đúng N lần (dùng với test data) |
| `constant-vus` | Closed | Số VU cố định | Giữ N VU chạy liên tục trong X giây |
| `ramping-vus` | Closed | VU tăng/giảm dần | Smoke / Load / Stress Test (thay thế `stages`) |
| `constant-arrival-rate` | Open | Iteration/giây cố định | Load Test thực tế, RPS không thay đổi |
| `ramping-arrival-rate` | Open | Iteration/giây tăng dần | Stress Test thực tế, tìm Breaking Point theo RPS |
| `externally-controlled` | — | Điều khiển từ CLI | Điều chỉnh tải thủ công trong lúc test đang chạy |

---

### 3.1. `shared-iterations` — Chia sẻ vòng lặp

Tổng số iteration được chia đều (không chính xác) cho các VU. VU nào nhanh sẽ chạy nhiều hơn.

```javascript
export const options = {
  scenarios: {
    smoke_check: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 200,  // 200 lần tổng cộng, chia cho 10 VU
      maxDuration: '30s',
    },
  },
};
```

```
VU 1: ████████████████ (chạy 25 lần — nhanh hơn)
VU 2: █████████████    (chạy 20 lần)
VU 3: ████████         (chạy 15 lần — chậm hơn)
...                    Tổng = 200 lần
```

> 💡 **Dùng khi:** Muốn kiểm thử chức năng với đúng N request, không quan trọng phân bổ như thế nào.

---

### 3.2. `per-vu-iterations` — Mỗi VU chạy đúng N lần

Mỗi VU chạy chính xác N iteration. Phù hợp khi dùng với **test data** cần phân bổ theo VU.

```javascript
export const options = {
  scenarios: {
    data_driven: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 20,      // Mỗi VU chạy đúng 20 lần → tổng 200 lần
      maxDuration: '1h30m',
    },
  },
};
```

> 💡 **Dùng khi:** Có file CSV 200 dòng, muốn mỗi VU xử lý đúng 20 dòng dữ liệu của mình.

---

### 3.3. `constant-vus` — Số VU cố định

Giữ N VU chạy liên tục trong suốt khoảng thời gian. Tương đương `{ vus: N, duration: 'Xm' }` cơ bản.

```javascript
export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
    },
  },
};
```

> 💡 **Dùng khi:** Cần giữ tải ổn định trong Soak Test hoặc giai đoạn Sustain của Load Test.

---

### 3.4. `ramping-vus` — Tăng/giảm VU dần dần ⭐

Đây là executor **phổ biến nhất** — chính xác là phiên bản nâng cao của `stages`.

```javascript
export const options = {
  scenarios: {
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },   // Ramp-up
        { duration: '10m', target: 100 },  // Sustain
        { duration: '5m', target: 0 },     // Ramp-down
      ],
      gracefulRampDown: '30s', // Cho VU đang chạy tối đa 30s để hoàn thành
    },
  },
};
```

**`gracefulRampDown` là gì?**

```
Không có gracefulRampDown:   VU bị kill ngay → request đang gửi bị ngắt giữa chừng → lỗi giả
Có gracefulRampDown: '30s':  VU được 30s để hoàn thành iteration hiện tại trước khi dừng
```

---

### 3.5. `constant-arrival-rate` — Tốc độ request cố định ⭐

Đảm bảo đúng N request/giây **bất kể server chậm hay nhanh**. Đây là executor Open Model quan trọng nhất.

```javascript
export const options = {
  scenarios: {
    api_load: {
      executor: 'constant-arrival-rate',
      duration: '10m',
      rate: 100,              // 100 iteration/giây
      timeUnit: '1s',
      preAllocatedVUs: 50,   // Khởi tạo sẵn 50 VU để tránh warm-up chậm
      maxVUs: 200,           // Tối đa 200 VU nếu server chậm và cần thêm
    },
  },
};
```

> ⚠️ **Lưu ý quan trọng:** Với `constant-arrival-rate`, **KHÔNG cần `sleep()`** ở cuối default function. Executor tự điều phối thời gian giữa các iteration.

**Cách chọn `preAllocatedVUs`:**

```
Công thức ước tính: preAllocatedVUs ≈ rate × avgResponseTime(s)
Ví dụ: rate=100 RPS, avgResponseTime=0.5s → cần ~50 VU
```

---

### 3.6. `ramping-arrival-rate` — Tốc độ request tăng dần

Tăng dần RPS theo thời gian — dùng để tìm **Breaking Point theo RPS** chính xác hơn `ramping-vus`.

```javascript
export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,          // Bắt đầu từ 10 RPS
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '2m', target: 50 },   // Tăng lên 50 RPS
        { duration: '5m', target: 50 },   // Giữ 50 RPS
        { duration: '2m', target: 200 },  // Tăng lên 200 RPS
        { duration: '5m', target: 200 },  // Giữ 200 RPS
        { duration: '2m', target: 500 },  // Đẩy lên 500 RPS
        { duration: '3m', target: 500 },
        { duration: '2m', target: 0 },
      ],
    },
  },
};
```

> 💡 **Tại sao tốt hơn `ramping-vus` cho Stress Test?**
> Với `ramping-vus`, khi server chậm → RPS tự giảm → bạn không biết Breaking Point thực sự.
> Với `ramping-arrival-rate`, RPS cố định → k6 tự thêm VU để đảm bảo → bạn thấy đúng lúc hệ thống gãy.

---

### 3.7. `externally-controlled` — Điều khiển thủ công từ CLI

Cho phép bạn điều chỉnh VU **trong khi test đang chạy** qua REST API hoặc CLI.

```javascript
export const options = {
  scenarios: {
    manual_control: {
      executor: 'externally-controlled',
      vus: 10,
      maxVUs: 500,
      duration: '30m',
    },
  },
};
```

```bash
# Trong terminal khác, tăng lên 100 VU ngay lập tức
k6 scale --vus 100

# Hoặc dùng REST API
curl -X PATCH http://localhost:6565/v1/status \
  -H 'Content-Type: application/json' \
  -d '{"data":{"attributes":{"vus":100}}}'
```

> 💡 **Dùng khi:** Demo live cho stakeholder, muốn tăng/giảm tải thủ công để quan sát phản ứng hệ thống real-time.

---

## 🎭 4. Scenarios — Chạy nhiều kịch bản song song

Đây là tính năng mạnh nhất. Bạn có thể kết hợp nhiều Executor **chạy đồng thời** trong một script.

### Cú pháp cơ bản của một Scenario

```javascript
export const options = {
  scenarios: {
    ten_scenario: {             // Tên tùy đặt (snake_case)

      // ── BẮT BUỘC ──────────────────────────────
      executor: 'constant-vus', // Loại executor

      // ── TÙY CHỌN CHUNG ────────────────────────
      startTime: '0s',          // Bắt đầu sau bao lâu kể từ khi test chạy
      gracefulStop: '30s',      // Thời gian cho VU hoàn thành trước khi force stop
      exec: 'myFunction',       // Hàm JS nào sẽ chạy (mặc định: default)
      env: { MY_VAR: 'value' }, // Biến môi trường riêng cho scenario này
      tags: { type: 'browse' }, // Tag riêng để lọc metric trên Grafana

      // ── EXECUTOR-SPECIFIC ──────────────────────
      vus: 50,
      duration: '10m',
    },
  },
};
```

---

### Ví dụ thực chiến — Mô phỏng e-commerce với 3 luồng đồng thời

```javascript
import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {

    // Luồng 1: Người dùng browse sản phẩm (nhiều nhất, tải nhẹ)
    browse_products: {
      executor: 'constant-vus',
      vus: 200,
      duration: '15m',
      exec: 'browseProducts',
      tags: { flow: 'browse' },
    },

    // Luồng 2: Người dùng thêm vào giỏ hàng (trung bình)
    add_to_cart: {
      executor: 'constant-arrival-rate',
      rate: 30,             // 30 request/giây
      timeUnit: '1s',
      duration: '15m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'addToCart',
      tags: { flow: 'cart' },
      startTime: '1m',      // Bắt đầu sau 1 phút (sau khi browse đã warm up)
    },

    // Luồng 3: Người dùng thanh toán (ít nhất, tải nặng nhất)
    checkout: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 10 },
        { duration: '10m', target: 20 },
        { duration: '3m', target: 0 },
      ],
      exec: 'doCheckout',
      tags: { flow: 'checkout' },
      startTime: '2m',      // Bắt đầu sau 2 phút
    },

  },
};

// ── HÀM CHO TỪNG SCENARIO ──────────────────────────────────────

export function browseProducts() {
  const res = http.get('https://api.example.com/products');
  check(res, { 'browse OK': (r) => r.status === 200 });
  sleep(Math.random() * 3 + 1); // Think time ngẫu nhiên 1-4 giây
}

export function addToCart() {
  const res = http.post('https://api.example.com/cart', JSON.stringify({
    productId: Math.floor(Math.random() * 100) + 1,
    quantity: 1,
  }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'add cart OK': (r) => r.status === 201 });
  // Không cần sleep() với constant-arrival-rate
}

export function doCheckout() {
  const res = http.post('https://api.example.com/checkout', JSON.stringify({
    cartId: `cart_${__VU}`,
  }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'checkout OK': (r) => r.status === 200 });
  sleep(2);
}
```

**Timeline của bài test trên:**

```
Phút 0  ──→ browse_products bắt đầu (200 VU)
Phút 1  ──→ add_to_cart bắt đầu (30 RPS)
Phút 2  ──→ checkout bắt đầu (ramp-up lên 10 VU)
Phút 4  ──→ checkout đạt 10 VU, tiếp tục ramp lên 20 VU
Phút 14 ──→ checkout ramp-down về 0
Phút 15 ──→ browse_products và add_to_cart kết thúc
```

---

### Scenarios chạy tuần tự (Sequential)

```javascript
export const options = {
  scenarios: {
    // Bước 1: Warm-up nhẹ
    warmup: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      startTime: '0s',
      exec: 'warmupFlow',
    },

    // Bước 2: Bắt đầu sau khi warm-up xong (2 phút)
    main_load: {
      executor: 'ramping-vus',
      startTime: '2m',      // Chờ warm-up xong
      stages: [
        { duration: '5m', target: 100 },
        { duration: '10m', target: 100 },
        { duration: '3m', target: 0 },
      ],
      exec: 'mainFlow',
    },
  },
};
```

---

## 🔎 5. Truy xuất thông tin Scenario đang chạy với `k6/execution`

Khi có nhiều Scenario, đôi khi bạn cần biết VU hiện tại đang ở đâu.

```javascript
import exec from 'k6/execution';

export default function () {
  // Thông tin về VU hiện tại
  console.log(`VU ID: ${exec.vu.idInTest}`);          // ID VU trong toàn bài test
  console.log(`VU iteration: ${exec.vu.iterationInScenario}`); // Lần lặp thứ mấy

  // Thông tin về Scenario đang chạy
  console.log(`Scenario: ${exec.scenario.name}`);      // Tên scenario
  console.log(`Iteration: ${exec.scenario.iterationInTest}`);

  // Dùng để phân bổ test data theo VU
  const users = ['alice', 'bob', 'charlie', 'dave'];
  const myUser = users[exec.vu.idInTest % users.length];
  console.log(`VU này sẽ login với: ${myUser}`);
}
```

**Ứng dụng thực tế — Phân bổ test data không trùng lặp:**

```javascript
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', function () {
  return JSON.parse(open('./users.json'));
});

export function browseProducts() {
  // Mỗi VU dùng đúng một user riêng của mình
  const myUser = users[exec.vu.idInTest - 1];

  http.post('https://api.example.com/login', JSON.stringify({
    email: myUser.email,
    password: myUser.password,
  }));
}
```

---

## 🏷️ 6. Tags trong Scenarios — Lọc metric trên Grafana

Một trong những lợi ích lớn nhất của Scenarios là bạn có thể **gắn tag riêng** cho từng luồng.

```javascript
export const options = {
  scenarios: {
    browse: {
      executor: 'constant-vus',
      vus: 100,
      duration: '10m',
      tags: { flow: 'browse', criticality: 'low' },
    },
    checkout: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      tags: { flow: 'checkout', criticality: 'high' },
    },
  },
};
```

Trên Grafana, bạn có thể lọc:
- `flow = checkout` → Xem riêng p(95) của luồng thanh toán
- `criticality = high` → Alert riêng cho các luồng quan trọng

---

## 📋 7. Tổng hợp — Chọn Executor nào?

```
Câu hỏi                                      Executor phù hợp
─────────────────────────────────────────────────────────────────────
Chạy đúng tổng X iteration?                 → shared-iterations
Mỗi VU chạy đúng N lần? (test data)         → per-vu-iterations
Giữ N VU chạy trong X giây?                 → constant-vus
Tăng/giảm VU theo thời gian?                → ramping-vus ⭐
Cần đúng N RPS bất kể server nhanh/chậm?    → constant-arrival-rate ⭐
Tăng dần RPS để tìm Breaking Point?         → ramping-arrival-rate
Điều chỉnh thủ công trong lúc chạy?         → externally-controlled
```

---

## 💡 8. Best Practices

**Luôn đặt `gracefulStop`:**
```javascript
gracefulStop: '30s', // Cho VU 30s để finish iteration trước khi kill
```

**Đặt `startTime` để tránh "cold start":**
```javascript
// Scenario quan trọng bắt đầu sau 30s warm-up
startTime: '30s',
```

**Dùng `exec` để tách biệt hàm rõ ràng:**
```javascript
exec: 'checkoutFlow', // Rõ ràng hơn là nhét hết vào default function
```

**Đặt `tags` để phân tích Grafana dễ hơn:**
```javascript
tags: { flow: 'checkout', env: 'staging' },
```

**Tính `preAllocatedVUs` đúng cho `arrival-rate`:**
```javascript
// preAllocatedVUs = rate × expected_avg_response_time_in_seconds
// Ví dụ: 100 RPS × 0.5s avg = 50 VU
preAllocatedVUs: 50,
maxVUs: 200, // Buffer 4x để phòng khi server chậm đột ngột
```

---

## 📝 9. Tóm tắt

| Khái niệm | Vai trò |
|---|---|
| **Scenario** | Định nghĩa "kịch bản" — hàm nào chạy, bắt đầu khi nào, tag gì |
| **Executor** | Động cơ — điều phối VU và iteration như thế nào |
| **Closed Model** | VU cố định, RPS phụ thuộc vào tốc độ server |
| **Open Model** | RPS cố định, VU tự động điều chỉnh theo tốc độ server |
| **`exec`** | Kết nối Scenario với hàm JavaScript cụ thể |
| **`startTime`** | Làm cho các Scenario chạy tuần tự thay vì song song |
| **`tags`** | Gắn nhãn để lọc metric riêng trên Grafana |

---

## 📚 10. Nguồn tham khảo

- [k6 Docs: Scenarios](https://grafana.com/docs/k6/latest/using-k6/scenarios/)
- [k6 Docs: Executors](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/)
- [k6 Docs: constant-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/)
- [k6 Docs: ramping-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-arrival-rate/)
- [k6 Docs: Open & Closed Models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)
- [k6 Docs: k6/execution API](https://grafana.com/docs/k6/latest/javascript-api/k6-execution/)
- [k6 Docs: Arrival-rate VU allocation](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/arrival-rate-vu-allocation/)