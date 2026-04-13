# 📊 Bài học: Custom Metrics trong k6

> **Phase 3 – Bài nâng cao** | Thuộc chuỗi học k6 Performance Testing
> 🔗 Tài liệu gốc: [Grafana k6 – Create Custom Metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/create-custom-metrics/)

---

## 🎯 Mục tiêu bài học

Sau bài này, bạn sẽ:

- Hiểu **tại sao** cần Custom Metrics thay vì chỉ dùng built-in metrics
- Nắm vững **4 loại Custom Metric**: `Counter`, `Gauge`, `Rate`, `Trend`
- Biết cách **khai báo, sử dụng, và kết hợp với Threshold**
- Áp dụng vào **bài toán thực tế** trong dự án

---

## 🤔 Tại sao cần Custom Metrics?

Built-in metrics của k6 (như `http_req_duration`, `http_req_failed`) rất hữu ích, nhưng **không đủ** cho mọi bài toán thực tế:

| Vấn đề thực tế | Built-in metrics có sẵn? | Cần Custom Metric? |
|---|---|---|
| Đo thời gian cả transaction (gồm cả sleep) | ❌ | ✅ |
| Đếm số lần retry | ❌ | ✅ |
| Tỉ lệ login thành công theo business logic | ❌ | ✅ |
| Theo dõi số active session | ❌ | ✅ |
| Đo thời gian chờ server riêng cho từng API | ⚠️ Có nhưng chung chung | ✅ Cụ thể hơn |

> 💡 **Tư duy quan trọng**: Built-in metrics đo ở tầng **HTTP/protocol**. Custom Metrics đo ở tầng **business logic** và **user experience** của bạn.

---

## 🧱 4 Loại Custom Metric

### Tổng quan nhanh

```
Counter  →  Đếm tổng cộng (chỉ tăng)
Gauge    →  Lưu giá trị tức thời (min / max / last)
Rate     →  Tỉ lệ phần trăm (true/false)
Trend    →  Thống kê phân phối (avg, p95, p99, min, max)
```

---

### 1️⃣ Counter – Bộ đếm tích lũy

**Dùng khi:** Muốn đếm số lần một sự kiện xảy ra (chỉ tăng, không giảm).

**Ví dụ thực tế:** Đếm số lần retry, số lỗi 5xx, số đơn hàng tạo thành công.

```javascript
import http from 'k6/http';
import { Counter } from 'k6/metrics';

// 1. Khai báo ở init context (ngoài hàm default)
const errorCount = new Counter('business_errors');
const retryCount = new Counter('retry_count');

export default function () {
  const res = http.get('https://api.example.com/orders');

  // 2. Gọi .add() để tăng bộ đếm
  if (res.status === 500) {
    errorCount.add(1);          // cộng thêm 1
  }

  if (res.status === 429) {
    retryCount.add(1, { endpoint: '/orders' }); // thêm tag để filter
  }
}
```

**Output cuối test:**
```
business_errors........: 3    0.15/s
retry_count............: 7    0.35/s
```

> ⚠️ **Lưu ý**: Counter bằng 0 ở cuối test sẽ **không hiển thị** trong summary.

---

### 2️⃣ Gauge – Đồng hồ giá trị hiện tại

**Dùng khi:** Muốn theo dõi một giá trị **thay đổi theo thời gian**, chỉ quan tâm min/max/last.

**Ví dụ thực tế:** Số VU đang active, số item trong queue, memory usage.

```javascript
import { Gauge } from 'k6/metrics';

// Track số VU đang chạy tại mỗi thời điểm
const activeVUs = new Gauge('active_vus');
const queueLength = new Gauge('queue_length');

export default function () {
  // Ghi nhận số VU hiện tại
  activeVUs.add(__VU);

  const res = http.get('https://api.example.com/queue/status');
  const body = JSON.parse(res.body);

  // Ghi nhận độ dài queue từ response
  queueLength.add(body.pending_count);
}
```

**Output cuối test:**
```
active_vus........: min=1  max=50 value=47
queue_length......: min=0  max=128 value=12
```

> 💡 `value` trong Gauge là **giá trị cuối cùng** được ghi nhận trước khi test kết thúc.

---

### 3️⃣ Rate – Tỉ lệ phần trăm

**Dùng khi:** Muốn tính **tỉ lệ** của một điều kiện true/false xảy ra.

**Ví dụ thực tế:** Tỉ lệ request thành công, tỉ lệ login đúng, tỉ lệ cache hit.

```javascript
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const loginSuccessRate = new Rate('login_success_rate');
const cacheHitRate = new Rate('cache_hit_rate');

export default function () {
  // Test login
  const loginRes = http.post('https://api.example.com/auth/login', {
    username: 'testuser',
    password: 'password123',
  });

  // .add(true) = thành công, .add(false) = thất bại
  loginSuccessRate.add(loginRes.status === 200);

  // Kiểm tra cache hit từ header
  const isCached = loginRes.headers['X-Cache'] === 'HIT';
  cacheHitRate.add(isCached);
}
```

**Output cuối test:**
```
login_success_rate.....: 97.50% ✓ 195  ✗ 5
cache_hit_rate.........: 82.00% ✓ 164  ✗ 36
```

---

### 4️⃣ Trend – Thống kê phân phối (⭐ Hay dùng nhất)

**Dùng khi:** Muốn đo **phân phối thời gian** hoặc số liệu liên tục → tính p95, p99, avg, min, max.

**Ví dụ thực tế:** Thời gian cả transaction (gồm sleep), thời gian render, số byte trả về.

```javascript
import http from 'k6/http';
import { sleep } from 'k6';
import { Trend } from 'k6/metrics';

// isTime=true → k6 biết đây là milliseconds, hiển thị đẹp hơn
const checkoutDuration = new Trend('checkout_flow_duration', true);
const apiWaitingTime = new Trend('api_server_waiting_time', true);

export default function () {
  // === Đo toàn bộ transaction checkout ===
  const txStart = Date.now();

  // Bước 1: Thêm vào giỏ
  http.post('https://api.example.com/cart/add', JSON.stringify({ productId: 1 }));
  sleep(1); // think time – built-in metric KHÔNG tính phần này

  // Bước 2: Thanh toán
  const checkoutRes = http.post('https://api.example.com/checkout');

  // Bước 3: Ghi nhận thời gian server chờ xử lý
  apiWaitingTime.add(checkoutRes.timings.waiting);

  sleep(0.5);

  const txEnd = Date.now();

  // Ghi nhận tổng thời gian transaction (bao gồm cả sleep)
  checkoutDuration.add(txEnd - txStart);
}
```

**Output cuối test:**
```
checkout_flow_duration......: avg=1.65s  min=1.51s  med=1.63s  max=2.1s  p(90)=1.82s  p(95)=1.95s
api_server_waiting_time.....: avg=145ms  min=98ms   med=140ms  max=312ms p(90)=198ms  p(95)=223ms
```

---

## 🛠️ Cách khai báo đúng (quan trọng!)

```javascript
// ✅ ĐÚNG: Khai báo ở INIT CONTEXT (ngoài export default)
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

const myCounter = new Counter('my_counter');
const myGauge   = new Gauge('my_gauge');
const myRate    = new Rate('my_rate');
const myTrend   = new Trend('my_trend', true); // true = đơn vị ms

export default function () {
  // Chỉ dùng .add() bên trong VU code
  myCounter.add(1);
  myGauge.add(42);
  myRate.add(true);
  myTrend.add(150);
}
```

```javascript
// ❌ SAI: Khai báo bên trong default function
export default function () {
  const myMetric = new Trend('my_trend'); // ← Lỗi! Sẽ bị tạo lại mỗi iteration
}
```

> 💡 **Quy tắc vàng**: `new Counter/Gauge/Rate/Trend()` chỉ gọi **một lần** ở init context. `.add()` gọi bao nhiêu lần tùy ý bên trong VU code.

---

## 🎯 Kết hợp Custom Metric với Threshold

Custom Metrics thực sự phát huy sức mạnh khi kết hợp với Threshold để tự động pass/fail test:

```javascript
import http from 'k6/http';
import { sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Định nghĩa custom metrics
const loginDuration    = new Trend('login_duration', true);
const loginSuccessRate = new Rate('login_success_rate');
const failedLogins     = new Counter('failed_logins');

export const options = {
  vus: 50,
  duration: '2m',

  thresholds: {
    // Login phải xong trong 500ms cho 95% request
    'login_duration': ['p(95) < 500'],

    // Tỉ lệ thành công phải trên 99%
    'login_success_rate': ['rate > 0.99'],

    // Số lần login thất bại không quá 10 lần
    'failed_logins': ['count < 10'],
  },
};

export default function () {
  const start = Date.now();

  const res = http.post('https://api.example.com/auth/login', {
    username: `user_${__VU}`,
    password: 'test_password',
  });

  const duration = Date.now() - start;
  const success = res.status === 200;

  loginDuration.add(duration);
  loginSuccessRate.add(success);

  if (!success) {
    failedLogins.add(1, { status: res.status.toString() });
  }

  sleep(1);
}
```

**Output khi pass:**
```
✓ login_duration.........: p(95)=342ms < 500ms    ✅
✓ login_success_rate.....: rate=99.8% > 99%       ✅
✓ failed_logins..........: count=2 < 10            ✅
```

**Output khi fail:**
```
✗ login_duration.........: p(95)=612ms < 500ms    ❌ (threshold breached)
```

---

## 🏗️ Ví dụ thực chiến: E-commerce Flow

Đây là ví dụ đầy đủ mô phỏng luồng mua hàng, đo đúng những gì business quan tâm:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';

// ===== CUSTOM METRICS =====
const searchDuration    = new Trend('search_duration', true);
const addToCartDuration = new Trend('add_to_cart_duration', true);
const checkoutDuration  = new Trend('checkout_duration', true);
const orderSuccessRate  = new Rate('order_success_rate');
const totalOrders       = new Counter('total_orders_placed');
const activeUsers       = new Gauge('active_users_gauge');

// ===== OPTIONS =====
export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'search_duration':     ['p(95) < 800'],
    'add_to_cart_duration':['p(95) < 400'],
    'checkout_duration':   ['p(95) < 1500'],
    'order_success_rate':  ['rate > 0.95'],
  },
};

// ===== TEST LOGIC =====
export default function () {
  activeUsers.add(__VU);

  // === BƯỚC 1: Tìm kiếm sản phẩm ===
  const t0 = Date.now();
  const searchRes = http.get('https://api.example.com/products?q=laptop');
  searchDuration.add(Date.now() - t0);

  check(searchRes, { 'search ok': (r) => r.status === 200 });
  sleep(1);

  // === BƯỚC 2: Thêm vào giỏ hàng ===
  const t1 = Date.now();
  const cartRes = http.post(
    'https://api.example.com/cart',
    JSON.stringify({ productId: 'LAPTOP-001', qty: 1 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  addToCartDuration.add(Date.now() - t1);

  check(cartRes, { 'add to cart ok': (r) => r.status === 201 });
  sleep(2);

  // === BƯỚC 3: Checkout ===
  const t2 = Date.now();
  const orderRes = http.post(
    'https://api.example.com/orders',
    JSON.stringify({ paymentMethod: 'credit_card' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  checkoutDuration.add(Date.now() - t2);

  const orderOk = orderRes.status === 201;
  orderSuccessRate.add(orderOk);

  if (orderOk) {
    totalOrders.add(1);
  }

  sleep(1);
}
```

---

## 📋 Bảng tổng hợp – Chọn loại metric nào?

| Câu hỏi cần trả lời | Dùng loại |
|---|---|
| "Đã xảy ra bao nhiêu lần?" | `Counter` |
| "Giá trị hiện tại là bao nhiêu?" | `Gauge` |
| "Tỉ lệ thành công/thất bại là bao nhiêu %?" | `Rate` |
| "Phân phối thời gian như thế nào (p95, avg)?" | `Trend` |

---

## 🔤 Quy tắc đặt tên metric

Theo giới hạn của OpenTelemetry và Prometheus:

```
✅ login_duration           → lowercase + underscore
✅ api_error_count          → rõ ràng, mô tả được
✅ checkout_success_rate    → tên gợi nhớ loại metric

❌ login-duration           → dấu gạch ngang không hợp lệ
❌ LoginDuration            → không dùng CamelCase
❌ my metric                → không có dấu cách
❌ 123_count                → không bắt đầu bằng số
```

**Quy ước gợi ý:**
```
{service}_{action}_{unit}
vd: checkout_process_duration
    login_attempt_success_rate
    cart_item_count
```

---

## ⚡ Tips & Best Practices

### ✅ Nên làm

```javascript
// Thêm tag để phân loại dữ liệu
failedRequests.add(1, { endpoint: '/api/orders', method: 'POST' });

// Dùng isTime=true cho Trend đo thời gian
const duration = new Trend('my_duration', true); // hiển thị đơn vị ms đẹp hơn

// Đặt tên metric theo convention nhất quán
const apiSearchDuration = new Trend('api_search_duration', true);
```

### ❌ Tránh

```javascript
// Đừng track quá nhiều metric không cần thiết → noise
// Chỉ đo những gì bạn thực sự quan tâm và sẽ action dựa trên đó

// Đừng khai báo metric trong VU code
export default function() {
  const m = new Counter('foo'); // ❌ Sai chỗ!
}
```

---

## 🔗 Liên kết với các bài trước

| Khái niệm | Bài học |
|---|---|
| Thresholds (dùng với custom metrics) | Phase 3 – Bài Thresholds |
| Built-in Metrics | Phase 1 – Bài 1.3 |
| Checks (kết hợp với Rate metric) | Phase 2 |
| Tags (dùng trong `.add()`) | Phase 2 – Tags and Groups |

---

## 🧪 Bài tập thực hành

**Level 1 – Cơ bản:**
Viết script đo thời gian response của 3 endpoint khác nhau dùng 3 `Trend` metric riêng biệt.

**Level 2 – Trung bình:**
Tạo `Rate` metric đo tỉ lệ response có header `Content-Type: application/json`. Đặt threshold yêu cầu tỉ lệ này > 99%.

**Level 3 – Nâng cao:**
Xây dựng script mô phỏng luồng đăng ký tài khoản → login → xem profile. Đo:
- Thời gian toàn bộ luồng (Trend)
- Tỉ lệ đăng ký thành công (Rate)
- Số lần gặp lỗi 5xx (Counter)

Kết hợp với Threshold để test tự động fail nếu p95 > 2 giây.

---

> 📌 **Ghi nhớ cốt lõi**: Custom Metrics giúp bạn chuyển từ "đo HTTP" sang "đo business". Hãy luôn hỏi: *"Stakeholder muốn biết điều gì?"* rồi mới chọn metric phù hợp.