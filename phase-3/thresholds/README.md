# Bài : Thresholds — Thiết lập "Chốt chặn" Pass/Fail tự động

> **Mục tiêu bài học:** Hiểu cách chuyển đổi các mục tiêu kinh doanh (SLO) thành tiêu chí kỹ thuật trong k6. Biết cách cấu hình Thresholds để tự động đánh trượt bài test nếu hệ thống không đạt yêu cầu về hiệu năng.

---

## Mục lục

1. [Thresholds là gì? Tại sao cần nó?](#1-thresholds-là-gì-tại-sao-cần-nó)
2. [Cú pháp Thresholds](#2-cú-pháp-thresholds)
3. [Thresholds theo từng loại Test](#3-thresholds-theo-từng-loại-test)
   - [Smoke Test](#31-smoke-test)
   - [Load Test](#32-load-test)
   - [Stress Test](#33-stress-test)
   - [Spike Test](#34-spike-test)
   - [Soak Test (Endurance Test)](#35-soak-test-endurance-test)
   - [Breakpoint Test](#36-breakpoint-test)
4. [Các ví dụ kỹ thuật nâng cao](#4-các-ví-dụ-kỹ-thuật-nâng-cao)
5. [Abort on Fail](#5-abort-on-fail)
6. [Kết hợp Threshold với Checks](#6-kết-hợp-threshold-với-checks)
7. [Cách đọc kết quả Pass/Fail](#7-cách-đọc-kết-quả-passfail)
8. [Bảng tổng hợp Thresholds theo loại test](#8-bảng-tổng-hợp-thresholds-theo-loại-test)
9. [Quy tắc vàng](#9-quy-tắc-vàng)
10. [Tài liệu tham khảo](#10-tài-liệu-tham-khảo)

---

## 1. Thresholds là gì? Tại sao cần nó?

**Thresholds** là tập hợp các tiêu chí đạt/hỏng (pass/fail) mà bạn thiết lập cho các chỉ số (metrics) của bài test. Nếu hệ thống không đáp ứng điều kiện đề ra, k6 kết thúc bài test với trạng thái **failed**.

### Mối liên hệ với SLO

| SLO (Yêu cầu kinh doanh) | Threshold tương ứng trong k6 |
|---|---|
| 95% người dùng tải trang dưới 2 giây | `http_req_duration: ['p(95) < 2000']` |
| Tỉ lệ lỗi không vượt quá 1% | `http_req_failed: ['rate < 0.01']` |
| Trang chủ luôn phản hồi dưới 300ms | `'http_req_duration{page:home}': ['p(99) < 300']` |

### Lợi ích trong CI/CD

Nếu Threshold không đạt, k6 trả về **exit code 99**. Điều này giúp Jenkins, GitHub Actions hay bất kỳ hệ thống CI/CD nào dừng quy trình deploy ngay lập tức — không cần ai ngồi theo dõi màn hình.

---

## 2. Cú pháp Thresholds

### Cấu trúc cơ bản

```javascript
export const options = {
  thresholds: {
    METRIC_NAME: ['THRESHOLD_EXPRESSION'],
  },
};
```

### Cú pháp biểu thức

```
<aggregation_method> <operator> <value>

// Ví dụ:
avg < 200        // thời gian trung bình phải dưới 200ms
count >= 500     // số lượng phải lớn hơn hoặc bằng 500
p(90) < 300      // 90% mẫu phải dưới 300ms
rate < 0.01      // tỉ lệ lỗi phải dưới 1%
```

### Phương thức tổng hợp theo từng loại metric

| Loại metric | Phương thức tổng hợp |
|---|---|
| Counter | `count`, `rate` |
| Gauge | `value` |
| Rate | `rate` |
| Trend | `avg`, `min`, `max`, `med`, `p(N)` — ví dụ `p(95)`, `p(99.9)` |

### Hai định dạng khai báo

```javascript
export const options = {
  thresholds: {
    // Định dạng ngắn
    METRIC_NAME1: ['EXPRESSION_1', 'EXPRESSION_2'],

    // Định dạng đầy đủ (dùng khi cần abortOnFail)
    METRIC_NAME2: [
      {
        threshold: 'EXPRESSION',
        abortOnFail: true,
        delayAbortEval: '10s',
      },
    ],
  },
};
```

> ⚠️ **Không khai báo cùng tên metric hai lần ở cấp key của object** — cái sau sẽ ghi đè cái trước không có cảnh báo. Nếu muốn nhiều điều kiện, hãy dùng mảng trong **cùng một key**.

```javascript
// ❌ SAI — metric_name thứ hai ghi đè thứ nhất
export const options = {
  thresholds: {
    metric_name: ['count < 100'],
    metric_name: ['rate < 50'],  // bị bỏ qua ngầm
  },
};

// ✅ ĐÚNG — dùng mảng cho cùng một key
export const options = {
  thresholds: {
    metric_name: ['count < 100', 'rate < 50'],
  },
};
```

---

## 3. Thresholds theo từng loại Test

### 3.1. Smoke Test

**Mục đích:** Kiểm tra nhanh hệ thống có hoạt động đúng không với tải tối thiểu (1–2 VU). Đây là bước sanity check trước khi chạy các bài test nặng hơn.

**Đặc điểm Threshold:**
- Ngưỡng **rất chặt** — nếu với 1 VU mà còn chậm thì có vấn đề nghiêm trọng
- Tập trung vào tính đúng đắn: error rate = 0%, response time thấp
- Dùng `abortOnFail: true` để dừng ngay nếu có lỗi

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    // Với Smoke Test: KHÔNG được có bất kỳ lỗi nào
    http_req_failed: [{
      threshold: 'rate == 0',
      abortOnFail: true,
    }],
    // Thời gian phản hồi phải rất thấp (không có tải)
    http_req_duration: ['p(95) < 200', 'p(99) < 500'],
    // Tất cả checks phải pass 100%
    checks: ['rate == 1'],
  },
};

export default function () {
  const res = http.get('https://example.com/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body.length > 0,
  });
  sleep(1);
}
```

---

### 3.2. Load Test

**Mục đích:** Kiểm tra hệ thống hoạt động ổn định dưới mức tải **bình thường và dự kiến** trong thực tế (ví dụ: 100 VU trong 30 phút).

**Đặc điểm Threshold:**
- Ngưỡng **thực tế** — phản ánh đúng SLO đã ký với khách hàng
- Cho phép một tỉ lệ lỗi nhỏ (< 1%)
- Kết hợp nhiều percentile để bao quát cả trường hợp thông thường lẫn ngoại lệ

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m',  target: 100 }, // ramp up
    { duration: '30m', target: 100 }, // giữ tải ổn định
    { duration: '5m',  target: 0   }, // ramp down
  ],
  thresholds: {
    // Tỉ lệ lỗi dưới 1%
    http_req_failed: ['rate < 0.01'],
    // Các mốc percentile phản ánh SLO
    http_req_duration: [
      'p(50) < 200',   // median dưới 200ms
      'p(90) < 500',   // 90% dưới 500ms
      'p(95) < 1000',  // 95% dưới 1 giây
      'p(99) < 2000',  // 99% dưới 2 giây
    ],
  },
};

export default function () {
  http.get('https://example.com');
  sleep(1);
}
```

---

### 3.3. Stress Test

**Mục đích:** Đẩy hệ thống vượt quá mức tải bình thường để tìm ra **điểm giới hạn** và xem hệ thống phục hồi như thế nào sau khi tải giảm.

**Đặc điểm Threshold:**
- Ngưỡng **nới lỏng hơn Load Test** — chấp nhận hệ thống bị chậm lại ở mức tải cao
- Tập trung vào **khả năng phục hồi**: sau khi tải giảm, các chỉ số phải trở về bình thường
- Cho phép error rate cao hơn (< 5%) ở đỉnh tải

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m',  target: 100  }, // tải bình thường
    { duration: '10m', target: 200  }, // vượt ngưỡng 2x
    { duration: '10m', target: 300  }, // vượt ngưỡng 3x
    { duration: '5m',  target: 0    }, // ramp down — kiểm tra phục hồi
  ],
  thresholds: {
    // Cho phép lỗi cao hơn ở mức stress (5%)
    http_req_failed: ['rate < 0.05'],
    // Ngưỡng thời gian nới lỏng hơn
    http_req_duration: [
      'p(95) < 3000',  // 95% phải dưới 3 giây (chấp nhận chậm hơn)
      'p(99) < 5000',  // 99% phải dưới 5 giây
    ],
    // Hệ thống vẫn phải phản hồi — không được treo hoàn toàn
    http_req_duration: ['max < 10000'],
  },
};

export default function () {
  http.get('https://example.com');
  sleep(1);
}
```

---

### 3.4. Spike Test

**Mục đích:** Kiểm tra hệ thống chịu đựng ra sao khi tải **tăng đột biến** trong thời gian cực ngắn (như flash sale, breaking news, ...).

**Đặc điểm Threshold:**
- Ngưỡng **linh hoạt theo giai đoạn**: cho phép degradation ở đỉnh spike, nhưng phải phục hồi nhanh
- Tập trung vào: hệ thống có sụp đổ hoàn toàn không? Có tự phục hồi không?
- Dùng tag để phân biệt giai đoạn bình thường vs đỉnh spike

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m',  target: 10  }, // tải nền bình thường
    { duration: '30s', target: 500 }, // đột biến lên 500 VU
    { duration: '1m',  target: 500 }, // giữ đỉnh spike
    { duration: '30s', target: 10  }, // giảm đột ngột
    { duration: '3m',  target: 10  }, // kiểm tra phục hồi
  ],
  thresholds: {
    // Hệ thống không được sụp hoàn toàn — cho phép lỗi cao trong spike
    http_req_failed: ['rate < 0.10'],
    // Thời gian phản hồi: chấp nhận chậm ở đỉnh, không giới hạn chặt
    http_req_duration: ['p(95) < 5000'],
    // Điều quan trọng nhất: hệ thống vẫn phải phản hồi
    http_req_duration: ['max < 15000'],
  },
};

export default function () {
  http.get('https://example.com');
  sleep(1);
}
```

---

### 3.5. Soak Test (Endurance Test)

**Mục đích:** Chạy tải **bình thường trong thời gian dài** (vài giờ đến vài ngày) để phát hiện memory leak, resource exhaustion, hay degradation theo thời gian.

**Đặc điểm Threshold:**
- Ngưỡng **tương đương Load Test** nhưng mục tiêu khác: đảm bảo chỉ số **không xấu đi** theo thời gian
- Chú ý đặc biệt đến error rate — ngưỡng rất chặt vì không phải đang ở đỉnh tải
- Nên monitor thêm custom metric theo thời gian để phát hiện degradation

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m',  target: 100 }, // ramp up
    { duration: '8h',  target: 100 }, // giữ ổn định 8 tiếng
    { duration: '5m',  target: 0   }, // ramp down
  ],
  thresholds: {
    // Soak test: error rate phải gần như bằng 0 ở tải bình thường
    http_req_failed: ['rate < 0.005'],
    // Thời gian phản hồi không được xấu đi theo thời gian
    http_req_duration: [
      'p(95) < 500',
      'p(99) < 1000',
      // avg để phát hiện xu hướng tăng dần (memory leak)
      'avg < 300',
    ],
    // Số lượng request thành công phải đủ lớn (hệ thống không treo)
    http_reqs: ['count > 1000'],
  },
};

export default function () {
  http.get('https://example.com');
  sleep(1);
}
```

---

### 3.6. Breakpoint Test

**Mục đích:** Tăng tải **liên tục không ngừng** cho đến khi hệ thống sụp đổ, nhằm tìm ra **điểm vỡ** (breaking point) chính xác.

**Đặc điểm Threshold:**
- Không đặt ngưỡng chặt — **mục đích là để test fail**
- Dùng `abortOnFail: true` để dừng ngay khi hệ thống sụp hẳn
- Ghi nhận giá trị VU tại thời điểm fail để biết giới hạn thực tế

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  // Tăng liên tục: 10 VU/phút, không giới hạn
  stages: [
    { duration: '2h', target: 10000 },
  ],
  thresholds: {
    // Dừng khi error rate vượt 30% — hệ thống đã sụp
    http_req_failed: [{
      threshold: 'rate < 0.30',
      abortOnFail: true,
      delayAbortEval: '1m', // chờ 1 phút để chắc chắn không phải spike tạm thời
    }],
    // Hoặc dừng khi thời gian phản hồi quá tệ
    http_req_duration: [{
      threshold: 'p(95) < 60000', // 60 giây — gần như không phản hồi
      abortOnFail: true,
      delayAbortEval: '1m',
    }],
  },
};

export default function () {
  http.get('https://example.com');
  sleep(1);
}
```

---

## 4. Các ví dụ kỹ thuật nâng cao

### 4.1. Threshold theo Tag (phân loại từng endpoint)

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  thresholds: {
    // API endpoint phải nhanh hơn
    'http_req_duration{type:API}':           ['p(95) < 500'],
    // Static content (ảnh, CSS, JS) thường nhanh hơn
    'http_req_duration{type:staticContent}': ['p(95) < 200'],
  },
};

export default function () {
  http.get('https://example.com/api/users',   { tags: { type: 'API' } });
  http.get('https://example.com/api/orders',  { tags: { type: 'API' } });

  http.batch([
    ['GET', 'https://example.com/logo.png',  null, { tags: { type: 'staticContent' } }],
    ['GET', 'https://example.com/style.css', null, { tags: { type: 'staticContent' } }],
  ]);

  sleep(1);
}
```

### 4.2. Threshold theo Group

```javascript
import http from 'k6/http';
import { group, sleep } from 'k6';

export const options = {
  thresholds: {
    'group_duration{group:::Login Flow}':    ['avg < 500'],
    'group_duration{group:::Checkout Flow}': ['avg < 2000'],
  },
  vus: 10,
  duration: '5m',
};

export default function () {
  group('Login Flow', function () {
    http.post('https://example.com/api/login',   JSON.stringify({ user: 'test', pass: '123' }));
    http.get('https://example.com/dashboard');
  });

  group('Checkout Flow', function () {
    http.get('https://example.com/cart');
    http.post('https://example.com/api/checkout', JSON.stringify({ items: [1, 2, 3] }));
  });

  sleep(1);
}
```

### 4.3. Threshold trên tất cả loại Custom Metric

```javascript
import http from 'k6/http';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { sleep } from 'k6';

export const TrendRTT         = new Trend('RTT');
export const RateContentOK    = new Rate('ContentOK');
export const GaugeContentSize = new Gauge('ContentSize');
export const CounterErrors    = new Counter('Errors');

export const options = {
  thresholds: {
    // Counter: lỗi không được vượt quá 99 lần
    Errors: ['count < 100'],
    // Gauge: nội dung trả về phải nhỏ hơn 4000 bytes
    ContentSize: ['value < 4000'],
    // Rate: nội dung đúng phải đạt trên 95%
    ContentOK: ['rate > 0.95'],
    // Trend: nhiều điều kiện percentile, trung bình, median, min
    RTT: ['p(99) < 300', 'p(70) < 250', 'avg < 200', 'med < 150', 'min < 100'],
  },
};

export default function () {
  const res = http.get('https://example.com/api/data');
  const contentOK = res.status === 200;

  TrendRTT.add(res.timings.duration);
  RateContentOK.add(contentOK);
  GaugeContentSize.add(res.body.length);
  CounterErrors.add(!contentOK);

  sleep(1);
}
```

---

## 5. Abort on Fail

Dùng khi không muốn đợi bài test chạy hết mới biết nó hỏng. Tiết kiệm tài nguyên và thời gian.

```javascript
import http from 'k6/http';

export const options = {
  vus: 30,
  duration: '2m',
  thresholds: {
    http_req_duration: [{
      threshold: 'p(99) < 1000',
      abortOnFail: true,      // dừng ngay khi vi phạm
      delayAbortEval: '10s',  // chờ 10s để có đủ mẫu dữ liệu
    }],
    http_req_failed: [{
      threshold: 'rate < 0.01',
      abortOnFail: true,
      delayAbortEval: '30s',
    }],
  },
};

export default function () {
  http.get('https://example.com');
}
```

| Trường | Kiểu | Mô tả |
|---|---|---|
| `threshold` | string | Biểu thức điều kiện để đánh giá |
| `abortOnFail` | boolean | Dừng test ngay khi threshold trả về false |
| `delayAbortEval` | string | Thời gian chờ trước khi bắt đầu đánh giá, ví dụ `'10s'`, `'1m'` |

> ⚠️ Khi chạy trên **k6 Cloud**, threshold được đánh giá mỗi 60 giây — `abortOnFail` có thể bị trễ tối đa 60 giây.

---

## 6. Kết hợp Threshold với Checks

`check()` rất tốt để viết assertions, nhưng **checks không ảnh hưởng đến exit status**. Muốn bài test thực sự fail dựa trên kết quả check, bạn cần kết hợp với threshold trên metric `checks`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '10s',
  thresholds: {
    // Tỉ lệ check thành công phải trên 90%
    checks: ['rate > 0.9'],
    // Chỉ áp threshold cho check có tag cụ thể
    'checks{flow:checkout}': ['rate > 0.95'],
  },
};

export default function () {
  const loginRes = http.post('https://example.com/api/login',
    JSON.stringify({ user: 'test', pass: '123' })
  );
  check(loginRes, {
    'login status 200': (r) => r.status === 200,
  });

  const checkoutRes = http.post('https://example.com/api/checkout',
    JSON.stringify({ cart: [1, 2, 3] })
  );
  check(
    checkoutRes,
    { 'checkout status 200': (r) => r.status === 200 },
    { flow: 'checkout' } // tag này liên kết với threshold 'checks{flow:checkout}'
  );

  sleep(1);
}
```

---

## 7. Cách đọc kết quả Pass/Fail

```
  █ THRESHOLDS

    http_req_duration
    ✓ 'p(95)<200'   p(95)=148.21ms   ← ĐẠT (xanh)
    ✗ 'p(99)<500'   p(99)=652.10ms   ← VI PHẠM (đỏ)

    http_req_failed
    ✓ 'rate<0.01'   rate=0.05%       ← ĐẠT (xanh)
```

| Ký hiệu | Ý nghĩa | Exit Code |
|---|---|---|
| ✓ màu xanh | Tất cả threshold đạt | 0 (success) |
| ✗ màu đỏ | Ít nhất một threshold vi phạm | 99 (fail) |

---

## 8. Bảng tổng hợp Thresholds theo loại test

| Loại test | VU | Thời gian | `http_req_failed` | `p(95) duration` | `p(99) duration` | Ghi chú |
|---|---|---|---|---|---|---|
| **Smoke** | 1–2 | 1–5 phút | `rate == 0` | `< 200ms` | `< 500ms` | Ngưỡng chặt nhất, abortOnFail |
| **Load** | 50–500 | 15–60 phút | `< 1%` | `< 500ms` | `< 2000ms` | Phản ánh SLO thực tế |
| **Stress** | 500–2000 | 30–90 phút | `< 5%` | `< 3000ms` | `< 5000ms` | Nới lỏng, chấp nhận degradation |
| **Spike** | Đột biến ×5–×10 | 5–30 phút | `< 10%` | `< 5000ms` | `< 10000ms` | Ưu tiên: không sụp hoàn toàn |
| **Soak** | Bình thường | 2–24 giờ | `< 0.5%` | `< 500ms` | `< 1000ms` | Chặt như Load, focus degradation |
| **Breakpoint** | Tăng vô hạn | Đến khi sụp | `< 30%` | Không chặt | Không chặt | abortOnFail để tự dừng |

---

## 9. Quy tắc vàng

**Ưu tiên Percentile hơn Average:** Dùng `p(95)` hay `p(99)` thay vì `avg`. Average bị kéo bởi outlier và che giấu vấn đề. Percentile phản ánh đúng trải nghiệm của người dùng gặp vấn đề.

**Thực tế hóa ngưỡng:** Đừng đặt `p(95) < 50ms` nếu hạ tầng mạng không cho phép — bài test sẽ luôn fail vô ích. Hãy đo baseline trước rồi mới đặt ngưỡng.

**Dùng đúng loại Threshold cho đúng loại Test:** Ngưỡng của Smoke Test và Stress Test phải khác nhau — cùng một hệ thống nhưng kỳ vọng hành vi hoàn toàn khác.

**Kết hợp Custom Metric:** Đặt Threshold không chỉ cho built-in metrics mà cả chỉ số logic nghiệp vụ (tỉ lệ đăng nhập thành công, tỉ lệ lỗi thanh toán, ...).

**Không trùng key trong object:** Nếu cần nhiều điều kiện cho một metric, đặt tất cả trong mảng dưới cùng một key.

---

## 10. Tài liệu tham khảo

- [k6 Docs: Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) — Tài liệu gốc đầy đủ nhất
- [k6 Docs: Metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/) — Hiểu các loại metric trước khi đặt ngưỡng
- [k6 Docs: Test Types](https://grafana.com/docs/k6/latest/testing-guides/test-types/) — Phân loại các loại test
- [SRE Book: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) — Tư duy về SLO từ Google

---

> 💡 Với bài này, script k6 của bạn đã trở thành một bộ lọc chất lượng tự động hoàn chỉnh.
> Bài tiếp theo: **Organizing code — Tổ chức mã nguồn chuyên nghiệp** 🚀