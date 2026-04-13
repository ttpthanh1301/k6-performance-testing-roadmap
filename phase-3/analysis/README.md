# 🔍 Bài học: Phân tích Bottleneck & Grafana Dashboard

> **Phase 3 – Bài nâng cao** | Tiếp theo sau: Thresholds → Custom Metrics → **Phân tích Bottleneck**
> 🔗 Tài liệu gốc: [Grafana k6 – Results Output](https://grafana.com/docs/k6/latest/results-output/) | [Grafana Dashboards](https://grafana.com/docs/k6/latest/results-output/grafana-dashboards/)

---

## 🎯 Mục tiêu bài học

Sau bài này, bạn sẽ:

- Hiểu **quy trình phân tích bottleneck** từ kết quả k6
- Nhận biết được **các pattern lỗi** phổ biến qua metrics
- **Setup Grafana + InfluxDB** local để visualize real-time
- **Setup Grafana Cloud k6** để phân tích chuyên sâu (cloud)
- **Tự tạo panel** trong Grafana để monitor đúng điểm cần thiết

---

## 🧠 Phần 1: Tư duy phân tích Bottleneck

### Bottleneck là gì trong context k6?

Bottleneck là **điểm nghẽn** – nơi hệ thống không thể xử lý tải thêm mà không làm suy giảm performance. Biểu hiện:

```
Số VU tăng → Response time tăng đột biến → Error rate tăng
              ↑ đây chính là dấu hiệu bottleneck
```

### Framework phân tích: Đọc metrics theo thứ tự

Khi nhìn vào kết quả k6, hãy đọc theo trình tự **3 câu hỏi**:

```
1. CÓ LỖI KHÔNG?        → http_req_failed, checks
2. CHẬM Ở ĐÂU?          → http_req_duration (breakdown timings)
3. TẠI SAO CHẬM?        → Tương quan VUs vs response time
```

---

## 🔬 Phần 2: Đọc hiểu kết quả k6 như chuyên gia

### 2.1 Output chuẩn của k6

```
$ k6 run script.js

          /\      |‾‾| /‾‾/   /‾‾/
     /\  /  \     |  |/  /   /  /
    /  \/    \    |     (   /   ‾‾\
   /          \   |  |\  \ |  (‾)  |
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: load-test.js
     output: -

  scenarios: (100.00%) 1 scenario, 50 max VUs, 5m30s max duration
           * default: 50 looping VUs for 5m0s (gracefulStop: 30s)


✓ status is 200
✗ response < 500ms
 ↳  68% — ✓ 340 / ✗ 160           ← Dấu hiệu cần điều tra!

     checks.........................: 84.00% ✓ 680  ✗ 160
     data_received..................: 8.4 MB 28 kB/s
     data_sent......................: 1.4 MB 4.6 kB/s
     http_req_blocked...............: avg=1.92ms  min=1µs    med=5µs    max=167.44ms p(90)=9µs    p(95)=14µs
     http_req_connecting............: avg=1.01ms  min=0s     med=0s     max=167.44ms p(90)=0s     p(95)=0s
   ✓ http_req_duration..............: avg=349ms   min=148ms  med=317ms  max=2.31s    p(90)=578ms  p(95)=711ms
       { expected_response:true }...: avg=349ms   min=148ms  med=317ms  max=2.31s    p(90)=578ms  p(95)=711ms
     http_req_failed................: 0.00%  ✓ 0    ✗ 500
     http_req_receiving.............: avg=1.44ms  min=11µs   med=0.63ms max=47.89ms  p(90)=3.88ms p(95)=5.31ms
     http_req_sending...............: avg=0.19ms  min=6µs    med=0.14ms max=3.81ms   p(90)=0.37ms p(95)=0.52ms
     http_req_tls_handshaking.......: avg=0.9ms   min=0s     med=0s     max=84.44ms  p(90)=0s     p(95)=0s
     http_req_waiting...............: avg=347ms   min=148ms  med=315ms  max=2.31s    p(90)=575ms  p(95)=709ms
     http_reqs......................: 500    1.66/s
     iteration_duration.............: avg=1.34s   min=1.15s  med=1.32s  max=3.44s    p(90)=1.55s  p(95)=1.69s
     iterations.....................: 500    1.66/s
     vus............................: 2      min=2   max=50
     vus_max........................: 50     min=50  max=50
```

### 2.2 Giải mã từng metric quan trọng

#### 📊 Breakdown của `http_req_duration`

```
http_req_duration = blocked + connecting + tls_handshaking + sending + waiting + receiving

┌─────────────────────────────────────────────────────────────┐
│  blocked  │ connecting │ TLS │ sending │  WAITING  │ recv  │
│   DNS     │  TCP conn  │     │ upload  │  SERVER   │ down  │
│  lookup   │  setup     │     │ body    │ PROCESS   │ load  │
└─────────────────────────────────────────────────────────────┘
                                          ↑
                                   Thường là bottleneck chính
```

| Timing | Giá trị cao → Nguyên nhân | Giải pháp |
|---|---|---|
| `http_req_blocked` | DNS lookup chậm, connection pool đầy | Dùng keep-alive, tăng connection pool |
| `http_req_connecting` | Latency mạng cao, server xa | CDN, tối ưu network topology |
| `http_req_tls_handshaking` | TLS overhead | TLS session resumption, HTTP/2 |
| `http_req_sending` | Request body lớn | Compress payload |
| **`http_req_waiting`** | **Server xử lý chậm** | **Tối ưu DB query, cache, code** |
| `http_req_receiving` | Response body lớn, bandwidth | Pagination, compression |

> 💡 **Quy tắc thực chiến**: `http_req_waiting` chiếm > 80% `http_req_duration` → bottleneck ở **server-side**. Đây là trường hợp phổ biến nhất.

---

### 2.3 Nhận diện Pattern Bottleneck

#### Pattern 1: 🔴 Saturation – Server quá tải

```
Dấu hiệu:
  p95 tăng dần theo thời gian, không ổn định
  Khoảng cách avg → p99 ngày càng lớn (tail latency tăng)
  Error rate bắt đầu xuất hiện khi VU đạt ngưỡng nào đó

avg=120ms  p90=180ms  p95=220ms  p99=850ms  ← p99 outlier rất lớn!
              └─────────────────────┘
                     khoảng cách lớn = inconsistent performance
```

**Script để phát hiện:**
```javascript
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const waitingTime = new Trend('server_waiting', true);

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '2m', target: 30 },  // tăng dần
    { duration: '2m', target: 50 },
    { duration: '2m', target: 80 },  // tìm điểm saturation
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // Nếu p99 > 3x p50: saturation đang xảy ra
    'server_waiting': ['p(99) < 1000', 'p(50) < 350'],
  },
};

export default function () {
  const res = http.get('https://api.example.com/products');
  waitingTime.add(res.timings.waiting);
}
```

---

#### Pattern 2: 🟡 Memory Leak – Hệ thống chậm dần

```
Dấu hiệu:
  Response time tăng đều theo thời gian dù load không đổi
  Sau 30-60 phút, performance tệ hơn đầu test

  t=0min:   avg=120ms
  t=30min:  avg=180ms
  t=60min:  avg=290ms   ← cùng VU count nhưng chậm hơn!
```

**Phát hiện bằng Soak Test + Trend metric:**
```javascript
export const options = {
  duration: '2h',     // test dài để lộ memory leak
  vus: 20,
  thresholds: {
    // So sánh p95 đầu và cuối bằng cách tạo sub-metric theo tag
    'http_req_duration{phase:early}': ['p(95) < 400'],
    'http_req_duration{phase:late}':  ['p(95) < 400'],  // nếu late fail → leak!
  },
};

let iterCount = 0;
export default function () {
  iterCount++;
  const phase = iterCount < 1000 ? 'early' : 'late';

  http.get('https://api.example.com/data', {
    tags: { phase },
  });
}
```

---

#### Pattern 3: 🔵 Connection Pool Exhaustion – Spike ngắn

```
Dấu hiệu:
  http_req_blocked đột ngột tăng vọt (từ µs lên ms)
  Xảy ra khi VU tăng nhanh
  Sau khi VU ổn định, blocked time giảm lại

http_req_blocked: avg=1ms  p90=2ms  p99=167ms ← outlier 80x!
```

**Script phát hiện:**
```javascript
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const connectionErrors = new Counter('connection_errors');

export default function () {
  const res = http.get('https://api.example.com/endpoint', {
    timeout: '10s',
  });

  // blocked time > 100ms → connection pool issue
  if (res.timings.blocked > 100) {
    connectionErrors.add(1, { type: 'pool_exhaustion' });
  }
}
```

---

## 🖥️ Phần 3: Visualize bằng k6 Web Dashboard (Built-in – Không cần setup)

Cách nhanh nhất để xem real-time metrics mà **không cần cài gì thêm**:

```bash
# Bật web dashboard
K6_WEB_DASHBOARD=true k6 run script.js

# Truy cập
# → http://localhost:5665
```

**Dashboard hiện thị:**
- 📈 VUs theo thời gian
- ⏱️ Request duration (avg, p95, p99)
- ❌ Error rate
- 🔄 Requests/second

**Export HTML report:**
```bash
# Tự động export report sau khi test xong
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=report.html k6 run script.js
```

> ✅ **Dùng khi**: Debug nhanh, demo, không cần lưu history

---

## 🗄️ Phần 4: Setup Grafana + InfluxDB (Local – Self-hosted)

### 4.1 Kiến trúc

```
┌──────────┐   metrics    ┌──────────┐   query    ┌──────────┐
│   k6     │ ──────────→  │ InfluxDB │ ──────────→ │ Grafana  │
│ (runner) │  real-time   │ (storage)│             │  (viz)   │
└──────────┘              └──────────┘             └──────────┘
  port: N/A               port: 8086               port: 3000
```

### 4.2 Docker Compose Setup (Cách nhanh nhất)

Tạo file `docker-compose.yml`:

```yaml
version: "3.4"

networks:
  k6-monitoring:

services:
  # InfluxDB – lưu trữ metrics
  influxdb:
    image: influxdb:1.8
    networks:
      - k6-monitoring
    ports:
      - "8086:8086"
    environment:
      - INFLUXDB_DB=k6          # tên database
      - INFLUXDB_HTTP_AUTH_ENABLED=false
    volumes:
      - influxdb-data:/var/lib/influxdb

  # Grafana – visualize
  grafana:
    image: grafana/grafana:latest
    networks:
      - k6-monitoring
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - influxdb

volumes:
  influxdb-data:
  grafana-data:
```

**Khởi động:**
```bash
docker-compose up -d

# Kiểm tra
docker-compose ps

# Grafana: http://localhost:3000
# InfluxDB: http://localhost:8086
```

### 4.3 Chạy k6 với output InfluxDB

```bash
# Gửi metrics đến InfluxDB trong khi test chạy
k6 run --out influxdb=http://localhost:8086/k6 script.js

# Với tag để phân biệt các test run
k6 run --out influxdb=http://localhost:8086/k6 \
       --tag testid=load-test-2024-01-15 \
       script.js
```

### 4.4 Import Dashboard có sẵn vào Grafana

**Bước 1:** Vào Grafana → http://localhost:3000

**Bước 2:** Thêm InfluxDB Data Source
```
Configuration → Data Sources → Add data source
→ Chọn InfluxDB
→ URL: http://influxdb:8086
→ Database: k6
→ Save & Test
```

**Bước 3:** Import dashboard cộng đồng
```
Dashboards → Import
→ Nhập Dashboard ID: 2587    (k6 Load Testing Results – phổ biến nhất)
   hoặc ID: 14801            (K6 Dashboard – UI đẹp hơn)
   hoặc ID: 19431            (k6 InfluxDB 2.X – cho InfluxDB v2)
→ Chọn datasource: InfluxDB
→ Import
```

---

## 🎨 Phần 5: Tự tạo Grafana Panel (Nâng cao)

### 5.1 Các panel cần có trong một k6 dashboard chuẩn

```
┌────────────────────────────────────────────────────────┐
│  ROW 1: OVERVIEW                                       │
│  [VUs Active]  [Req/s]  [Error Rate]  [p95 Duration]  │
├────────────────────────────────────────────────────────┤
│  ROW 2: TIMELINE                                       │
│  [Response Time over time: avg, p90, p95, p99]        │
│  [VUs + RPS over time (dual axis)]                    │
├────────────────────────────────────────────────────────┤
│  ROW 3: ERROR ANALYSIS                                 │
│  [Error count by status code]                         │
│  [Failed requests timeline]                           │
├────────────────────────────────────────────────────────┤
│  ROW 4: REQUEST BREAKDOWN                              │
│  [http_req_waiting vs http_req_receiving]             │
│  [http_req_blocked timeline]                          │
└────────────────────────────────────────────────────────┘
```

### 5.2 Các query InfluxQL quan trọng

**Panel: Response Time Percentiles theo thời gian**
```sql
-- p95 của http_req_duration
SELECT percentile("value", 95)
FROM "http_req_duration"
WHERE $timeFilter
GROUP BY time($__interval)
```

**Panel: VUs active**
```sql
SELECT last("value")
FROM "vus"
WHERE $timeFilter
GROUP BY time($__interval)
```

**Panel: Request rate (RPS)**
```sql
SELECT non_negative_derivative(count("value"), 1s)
FROM "http_reqs"
WHERE $timeFilter
GROUP BY time($__interval)
```

**Panel: Error rate (%)**
```sql
SELECT mean("value") * 100
FROM "http_req_failed"
WHERE $timeFilter
GROUP BY time($__interval)
```

**Panel: Timing breakdown (stacked)**
```sql
-- waiting time
SELECT mean("value") FROM "http_req_waiting"
WHERE $timeFilter GROUP BY time($__interval)

-- receiving time
SELECT mean("value") FROM "http_req_receiving"
WHERE $timeFilter GROUP BY time($__interval)

-- blocked time
SELECT mean("value") FROM "http_req_blocked"
WHERE $timeFilter GROUP BY time($__interval)
```

### 5.3 Tạo panel "Response Time vs VUs" – Quan trọng nhất

Panel này giúp thấy rõ **điểm saturation**: khi VU tăng nhưng response time tăng không tuyến tính.

```
Cấu hình panel:
- Type: Time series
- Dual Y-axis:
  Left Y:  Response time (ms) – Series: p95, p99
  Right Y: VU count          – Series: vus

Trong Grafana:
1. Add panel → Time series
2. Add query A: p95 response time (trục trái)
3. Add query B: VU count → Override → Axis → Right
4. Thêm annotation khi error rate tăng
```

---

## ☁️ Phần 6: Grafana Cloud k6 (Cloud-based)

### 6.1 Khi nào dùng Grafana Cloud k6?

| | Local + InfluxDB | Grafana Cloud k6 |
|---|---|---|
| Chi phí | Miễn phí (tự host) | Free tier: 500 VUh/tháng |
| Setup | Cần Docker, cấu hình | Không cần setup |
| History | Tự quản lý | Tự động lưu tất cả |
| Collaboration | Phải tự share | Built-in |
| Scale | Giới hạn máy local | Lên đến 1M VUs |
| Tương quan với logs/traces | Cần tự setup | Tích hợp Grafana Cloud |

### 6.2 Setup Grafana Cloud k6

**Bước 1:** Tạo tài khoản tại [grafana.com](https://grafana.com) → Free tier

**Bước 2:** Lấy API token
```
Grafana Cloud → k6 → Settings → API Token → Create new token
```

**Bước 3:** Chạy test với output cloud
```bash
# Set token
export K6_CLOUD_TOKEN=your_api_token_here

# Chạy test và stream lên cloud
k6 cloud script.js

# Hoặc chạy local nhưng gửi kết quả lên cloud
k6 run --out cloud script.js
```

**Bước 4:** Xem kết quả
```
Grafana Cloud → k6 → Test Runs → [chọn test run]
```

### 6.3 Tính năng phân tích nâng cao của Grafana Cloud k6

**Correlation với server metrics:**
```
k6 Test Results → Xem spike lúc 14:32 → 
  Switch sang Grafana Explore → 
  Query Prometheus/Loki cùng time range → 
  Thấy CPU 98% trên app server lúc 14:32
  → Root cause: database lock
```

**Script để tag test run:**
```javascript
export const options = {
  ext: {
    loadimpact: {
      name: 'API Load Test - Sprint 42',     // tên hiển thị
      projectID: 3456789,                     // project ID trong Grafana Cloud
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:eu:dublin':  { loadZone: 'amazon:eu:dublin',  percent: 50 },
      },
    },
  },
};
```

### 6.4 Export Dashboard Summary

Sau khi test xong, Grafana Cloud k6 cho phép export kết quả thành Grafana dashboard để share:

```
Test Run → Actions → Export to Dashboard → 
  Chọn panels cần xuất (throughput, error rate, p95, ...) →
  Export → Dashboard được tạo tự động trong Grafana
```

---

## 🚀 Phần 7: Workflow phân tích Bottleneck thực chiến

### Quy trình 5 bước

```
┌─────────────────────────────────────────────────────────────────┐
│  BƯỚC 1: Chạy Smoke Test → Xác nhận script hoạt động đúng      │
│  BƯỚC 2: Chạy Load Test  → Benchmark baseline bình thường      │
│  BƯỚC 3: Chạy Stress Test→ Tăng dần VU, tìm điểm saturation   │
│  BƯỚC 4: Xem Grafana     → Identify metric nào bất thường      │
│  BƯỚC 5: Root Cause      → Tương quan với server metrics        │
└─────────────────────────────────────────────────────────────────┘
```

### Ví dụ thực tế: Phát hiện Database Bottleneck

```javascript
// script phân tích chi tiết từng endpoint
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Track từng endpoint riêng
const listProductsDuration  = new Trend('api_list_products',  true);
const getProductDuration    = new Trend('api_get_product',    true);
const searchProductDuration = new Trend('api_search_product', true);

const listProductsError  = new Rate('error_list_products');
const searchProductError = new Rate('error_search_product');

export const options = {
  stages: [
    { duration: '1m', target: 10  },
    { duration: '3m', target: 50  },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0   },
  ],
  thresholds: {
    'api_list_products':   ['p(95) < 200'],   // endpoint đơn giản
    'api_search_product':  ['p(95) < 800'],   // search phức tạp hơn
    'error_list_products': ['rate < 0.01'],
  },
};

export default function () {
  // Endpoint 1: List products (simple query)
  let t = Date.now();
  let res = http.get('https://api.example.com/products');
  listProductsDuration.add(Date.now() - t);
  listProductsError.add(res.status !== 200);
  sleep(0.5);

  // Endpoint 2: Get single product (by ID)
  t = Date.now();
  res = http.get(`https://api.example.com/products/${Math.floor(Math.random() * 1000)}`);
  getProductDuration.add(Date.now() - t);
  sleep(0.3);

  // Endpoint 3: Search (full-text search, thường là bottleneck)
  t = Date.now();
  res = http.get('https://api.example.com/products?q=laptop&sort=price');
  searchProductDuration.add(Date.now() - t);
  searchProductError.add(res.status !== 200);
  sleep(1);
}
```

**Kết quả trong Grafana sẽ lộ ra:**
```
api_list_products.....: avg=45ms   p(95)=89ms    ← OK ✅
api_get_product.......: avg=62ms   p(95)=134ms   ← OK ✅
api_search_product....: avg=1.2s   p(95)=3.8s    ← BOTTLENECK 🔴
```

**Bước tiếp theo sau khi xác định bottleneck:**
1. Mở Grafana Cloud → Xem thời điểm search p95 tăng
2. Correlate với Prometheus → Thấy DB CPU 100%
3. Correlate với Loki logs → Thấy query `SELECT * FROM products WHERE... ORDER BY price` không dùng index
4. Fix: Thêm composite index `(name_tsvector, price)`
5. Re-run test → So sánh kết quả

---

## 📊 Phần 8: Bảng tóm tắt – Chọn tool phù hợp

| Tình huống | Tool nên dùng |
|---|---|
| Debug nhanh trong dev | k6 Web Dashboard (`K6_WEB_DASHBOARD=true`) |
| Team local, không cần cloud | Grafana + InfluxDB (Docker Compose) |
| Cần lưu history, share với team | Grafana Cloud k6 (Free tier) |
| Load test lớn > 1000 VUs | Grafana Cloud k6 (Paid) |
| Tương quan với APM/logs | Grafana Cloud k6 + Grafana Stack |
| CI/CD pipeline | k6 CLI + JSON output + script phân tích |

---

## 🧪 Bài tập thực hành

**Level 1 – Cơ bản:**
Chạy script k6 bất kỳ với Web Dashboard, screenshot và giải thích từng số liệu thấy được.

**Level 2 – Trung bình:**
Setup Docker Compose với InfluxDB + Grafana, chạy test 5 phút với 20 VUs, import dashboard ID 2587, chụp screenshot 4 panel quan trọng nhất và giải thích ý nghĩa.

**Level 3 – Nâng cao:**
Viết script test 3 endpoint khác nhau của một API thực tế, mỗi endpoint có custom metric riêng. Chạy stress test (tăng dần từ 1→100 VU), xác định endpoint nào là bottleneck trước tiên và nêu giả thuyết về nguyên nhân.

---

## 🔗 Liên kết với các bài khác

| Khái niệm | Bài học liên quan |
|---|---|
| Thresholds → tự động fail khi bottleneck | Phase 3 – Bài Thresholds |
| Custom Metrics → đo chi tiết hơn built-in | Phase 3 – Bài Custom Metrics |
| Stress / Spike / Soak Test → loại test để tìm bottleneck | Phase 3 – Bài Test Types |
| Tags → filter theo endpoint trong Grafana | Phase 2 – Tags and Groups |

---

> 📌 **Ghi nhớ cốt lõi**: Chạy k6 chỉ là bước đầu. Giá trị thật sự nằm ở khả năng **đọc metrics, nhận ra pattern, và tìm ra nguyên nhân gốc rễ**. Grafana là công cụ biến raw numbers thành insight có thể action được.