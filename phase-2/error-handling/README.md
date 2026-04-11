# 🛡️ Bài 2.9: Error Handling & Retry Logic

> **Mục tiêu bài học:**
>
> - Hiểu hai loại lỗi phổ biến trong k6 và cách phân biệt chúng
> - Bao bọc code an toàn bằng `try-catch`
> - Xây dựng cơ chế tự động thử lại (Retry) khi gặp lỗi mạng tạm thời
> - Sử dụng `k6chaijs` để viết Assertions mạnh mẽ, dễ đọc hơn

---

## 🧠 1. Tại sao phải xử lý lỗi trong k6?

Trong k6, có **hai loại lỗi** chính cần phân biệt:

| Loại lỗi                      | Ví dụ                                    | Hậu quả                                         |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------- |
| **Lỗi kịch bản (Exception)**  | Parse JSON khi server trả về trang trắng | Dừng vòng lặp của VU ngay lập tức               |
| **Lỗi phản hồi (HTTP Error)** | Server trả về `404`, `503`               | k6 vẫn chạy tiếp nhưng dữ liệu test bị sai lệch |

> ⚠️ **Lưu ý quan trọng:** HTTP Error không làm script crash, nhưng nếu không xử lý, các bước phụ thuộc vào response đó (như Correlation) sẽ trả về `null` và gây ra Exception ở bước tiếp theo.

---

## 🛠️ 2. Xử lý Exception với `try-catch`

Hãy luôn bao bọc các đoạn code **"nhạy cảm"** như parse JSON hoặc Correlation để bảo vệ kịch bản không bị "đột tử".

### Ví dụ cơ bản

```javascript
import http from "k6/http";

export default function () {
  const res = http.get("https://dummyjson.com/users/1");

  try {
    // Nếu server bị lỗi không trả về JSON, dòng này sẽ gây crash
    const userData = res.json();
    console.log(`User name: ${userData.firstName}`);
  } catch (error) {
    console.warn(`⚠️ Không thể đọc dữ liệu User: ${error.message}`);
  }
}
```

### Ví dụ nâng cao — kết hợp `try-catch` với Custom Metric

```javascript
import http from "k6/http";
import { Rate } from "k6/metrics";

const parseErrorRate = new Rate("parse_errors");

export const options = {
  thresholds: {
    parse_errors: ["rate < 0.01"], // Không cho phép lỗi parse quá 1%
  },
};

export default function () {
  const res = http.get("https://dummyjson.com/users/1");
  let parseFailed = false;

  try {
    const userData = res.json();
    console.log(`User name: ${userData.firstName}`);
  } catch (error) {
    parseFailed = true;
    console.error(`❌ Parse thất bại [${res.status}]: ${error.message}`);
  }

  parseErrorRate.add(parseFailed);
}
```

> 💡 **Bổ sung:** Kết hợp `try-catch` với Custom Metric (học ở Bài 2.8) giúp bạn vừa bảo vệ script, vừa đo lường được tần suất lỗi parse — pipeline CI/CD sẽ tự động FAIL nếu vượt ngưỡng.

---

## 🔄 3. Cơ chế Thử lại (Retry Logic)

Đôi khi server chỉ bị nghẽn trong vài giây. Thay vì đánh trượt request đó, ta thử lại thêm 1-2 lần. k6 không có hàm `retry` sẵn, nên ta tự viết một hàm wrapper.

### Hàm `httpGetWithRetry` cơ bản

```javascript
import http from "k6/http";
import { sleep } from "k6";

function httpGetWithRetry(url, params, maxRetries = 3) {
  let res;
  for (let retries = 0; retries < maxRetries; retries++) {
    res = http.get(url, params);

    // Nếu status < 500 (không phải lỗi server) thì dừng thử lại
    if (res.status < 500) {
      return res;
    }

    console.log(`🔄 Thử lại lần ${retries + 1}/${maxRetries} cho URL: ${url}`);
    sleep(1); // Nghỉ một chút trước khi thử lại
  }
  return res;
}

export default function () {
  const res = httpGetWithRetry("https://api.example.com/data");
}
```

### Hàm Retry nâng cao — Exponential Backoff

> 💡 **Bổ sung kiến thức:** Trong thực tế, thay vì `sleep(1)` cố định, kỹ thuật **Exponential Backoff** tăng dần thời gian chờ theo mỗi lần thử. Điều này giúp tránh làm server bị dồn dập khi đang hồi phục.

```javascript
import http from "k6/http";
import { sleep } from "k6";

/**
 * Gửi GET request với cơ chế thử lại theo Exponential Backoff.
 * @param {string} url         - URL cần gọi
 * @param {object} params      - Tham số của request (headers, timeout, ...)
 * @param {number} maxRetries  - Số lần thử tối đa (mặc định: 3)
 * @param {number} baseDelay   - Thời gian chờ cơ bản tính bằng giây (mặc định: 1)
 * @returns {Response}         - Response cuối cùng nhận được
 */
function httpGetWithRetry(url, params = {}, maxRetries = 3, baseDelay = 1) {
  let res;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    res = http.get(url, params);

    if (res.status < 500) {
      return res; // Thành công, dừng lại
    }

    const waitTime = baseDelay * Math.pow(2, attempt); // 1s → 2s → 4s
    console.warn(
      `🔄 Lần ${attempt + 1}/${maxRetries} thất bại (${res.status}). Chờ ${waitTime}s...`,
    );
    sleep(waitTime);
  }

  console.error(`❌ Tất cả ${maxRetries} lần thử đều thất bại cho: ${url}`);
  return res;
}

export default function () {
  const res = httpGetWithRetry("https://api.example.com/data", {}, 3, 1);
  console.log(`Kết quả cuối: ${res.status}`);
}
```

**Lịch trình chờ của Exponential Backoff:**

| Lần thử | Thời gian chờ |
| ------- | ------------- |
| Lần 1   | 1 giây        |
| Lần 2   | 2 giây        |
| Lần 3   | 4 giây        |

---

## 🧪 4. Assertions nâng cao với `k6chaijs`

Nếu bạn đã quen với thư viện **Chai** trong kiểm thử (Mocha/Chai), bạn sẽ rất thích `k6chaijs`. Nó giúp các câu lệnh kiểm chứng trông như ngôn ngữ tự nhiên.

### So sánh `check()` truyền thống vs `k6chaijs`

```javascript
// ✅ Cách cũ — check() truyền thống
check(res, {
  "status là 200": (r) => r.status === 200,
  "body là object": (r) => typeof r.json() === "object",
  "có tên sản phẩm": (r) => r.json().title !== undefined,
});

// ✅ Cách mới — k6chaijs (dễ đọc hơn)
describe("Kiểm tra chi tiết sản phẩm", () => {
  expect(res.status, "Status code").to.equal(200);
  expect(res.json(), "Body").to.be.an("object");
  expect(res.json().title, "Tên sản phẩm").to.have.string("iPhone");
});
```

### Ví dụ đầy đủ

```javascript
import {
  describe,
  expect,
} from "https://jslib.k6.io/k6chaijs/4.3.4.3/index.js";
import http from "k6/http";

export default function () {
  const res = http.get("https://dummyjson.com/products/1");

  describe("Kiểm tra chi tiết sản phẩm", () => {
    expect(res.status, "Status code").to.equal(200);
    expect(res.json(), "Body").to.be.an("object");
    expect(res.json().title, "Tên sản phẩm").to.have.string("iPhone");
    expect(res.timings.duration, "Response time").to.be.below(2000); // Dưới 2 giây
  });
}
```

### Bổ sung — Một số Assertions thường dùng

```javascript
// Kiểm tra kiểu dữ liệu
expect(value).to.be.a("string");
expect(value).to.be.an("array");
expect(value).to.be.a("number");

// Kiểm tra giá trị
expect(value).to.equal(200);
expect(value).to.not.equal(0);
expect(value).to.be.above(0); // Lớn hơn
expect(value).to.be.below(1000); // Nhỏ hơn
expect(value).to.be.within(1, 100); // Trong khoảng

// Kiểm tra chuỗi
expect(str).to.include("keyword");
expect(str).to.have.string("token");
expect(str).to.match(/^Bearer .+/); // Regex

// Kiểm tra mảng / object
expect(arr).to.have.lengthOf(5);
expect(arr).to.include(42);
expect(obj).to.have.property("id");
expect(obj).to.deep.equal({ id: 1, name: "Test" });
```

> 💡 **Lưu ý:** Khi dùng `describe/expect`, nếu một Assertion bị fail, k6 ném ra Exception. Hãy bao bọc trong `try-catch` để tránh script bị dừng giữa chừng.

```javascript
describe("An toàn hơn với try-catch", () => {
  try {
    expect(res.status).to.equal(200);
    expect(res.json().id).to.be.a("number");
  } catch (e) {
    console.error(`Assertion thất bại: ${e.message}`);
  }
});
```

---

## ⚠️ 5. Những "Cái bẫy" cần tránh

### ❌ Retry quá đà

```javascript
// KHÔNG nên làm — 10 lần retry sẽ làm Load Generator bị quá tải
const res = httpGetWithRetry(url, {}, 10);
```

> Nếu server thực sự sập, việc thử lại liên tục sẽ làm Load Generator bị quá tải. Giới hạn `maxRetries` ở mức **2-3 lần** là đủ.

### ❌ Lạm dụng `k6chaijs`

`k6chaijs` tốn tài nguyên hơn `check()` truyền thống do phải parse chuỗi assertion. Chỉ nên dùng khi:

- Viết **Integration Test** phức tạp trên nền k6
- Cần **Assertion có điều kiện** hoặc kiểm tra cấu trúc JSON sâu

Với **Load Test** đơn thuần, hãy dùng `check()` để tiết kiệm tài nguyên VU.

### ❌ Bỏ quên Logging

```javascript
// ❌ Sai — nuốt lỗi im lặng, không biết gì xảy ra
} catch (error) {}

// ✅ Đúng — log đủ thông tin để debug
} catch (error) {
  console.error(`[VU ${__VU}] ❌ Lỗi tại ${url}: ${error.message}`);
}
```

> Hãy dùng `console.error` / `console.warn` kèm biến `__VU` (ID của Virtual User) và `__ITER` (số vòng lặp) để biết chính xác lỗi xảy ra ở đâu khi xem Log.

---

## 🗺️ 6. Tổng hợp — Khi nào dùng gì?

```
Vấn đề gặp phải                   →  Giải pháp
─────────────────────────────────────────────────────
Parse JSON có thể bị lỗi          →  try-catch
Server thỉnh thoảng trả về 5xx    →  Retry + Exponential Backoff
Cần đo tần suất lỗi logic         →  try-catch + Custom Rate Metric
Kiểm tra cấu trúc response đơn    →  check()
Kiểm tra response phức tạp        →  k6chaijs describe/expect
```

---

## 📚 7. Nguồn tham khảo

- [k6 Docs: Error Handling](https://grafana.com/docs/k6/latest/examples/error-handler/)
- [k6 Jslib: k6chaijs](https://grafana.com/docs/k6/latest/javascript-api/jslib/k6chaijs/)
- [Retry Pattern — Microsoft Azure Architecture](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)
- [Exponential Backoff — Google Cloud](https://cloud.google.com/memorystore/docs/redis/exponential-backoff)
- [k6 Built-in Variables: `__VU`, `__ITER`](https://grafana.com/docs/k6/latest/using-k6/globals/)
