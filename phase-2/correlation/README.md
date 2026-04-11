# 📘 Chương 2: Kỹ thuật Nâng cao trong k6

---

## 🔗 Bài 2.7: Làm chủ Correlation (Xử lý dữ liệu động)

**Mục tiêu bài học:** Hiểu bản chất của Correlation. Biết cách trích xuất Token, Session ID, CSRF từ HTML, JSON hoặc XML để tái sử dụng cho các request sau, giúp kịch bản test không bị "chết" do token hết hạn.

---

### 🧠 1. Correlation là gì? Tại sao phải cần nó?

**Correlation (Tương quan)** là quá trình trích xuất một giá trị từ Response của request trước để nhét vào Request của bước sau.

**Tại sao cần?**

Khi bạn thao tác trên web, server thường sinh ra các giá trị tạm thời như:

| Giá trị | Mô tả |
|---|---|
| **Session ID / Cookie** | Định danh phiên làm việc |
| **CSRF Token** | Chống giả mạo request (thường nằm trong thẻ `<input type="hidden">`) |
| **ViewState** | (Phổ biến trong .NET) Lưu trạng thái trang web |

> ⚠️ Các giá trị này hết hạn rất nhanh. Nếu bạn "gắn chết" (hardcode) giá trị từ lúc quay phim vào script, server sẽ từ chối request vì token đó đã cũ.

---

### 📥 2. Cách 1: Trích xuất từ JSON Response

Đây là cách hiện đại và phổ biến nhất khi test các hệ thống Single Page App (React, Vue, v.v.).

```javascript
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  // 1. Gọi API lấy danh sách nguyên liệu
  const res = http.get('https://quickpizza.grafana.com/api/doughs');

  // 2. Trích xuất ID của loại đế bánh đầu tiên
  // res.json() sẽ chuyển body thành một Object JavaScript
  const firstDoughId = res.json().doughs[0].ID;

  console.log(`Đã trích xuất được ID đế bánh: ${firstDoughId}`);

  // 3. Dùng ID đó cho request tiếp theo
  const orderRes = http.get(`https://quickpizza.grafana.com/api/doughs/${firstDoughId}`);

  check(orderRes, {
    'Truy xuất chi tiết thành công': (r) => r.status === 200,
  });
}
```

---

### 📝 3. Cách 2: Trích xuất từ HTML (Form / Hidden Fields)

Dùng cho các trang web truyền thống, nơi CSRF Token được giấu trong các thẻ `input`.

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export default function () {
  // 1. Truy cập trang chứa Form.
  // Lưu ý: responseType: 'text' giúp k6 hiểu đây là trang HTML để parse
  const res = http.get('https://test.k6.io/my_messages.php', { responseType: 'text' });

  // 2. Tìm thẻ <input name="redir"> và lấy giá trị của thuộc tính "value"
  const csrfToken = res.html().find('input[name=redir]').attr('value');

  console.log('CSRF Token trích xuất được là: ' + csrfToken);

  // 3. Gửi Token này kèm theo request POST sau đó
  http.post('https://test.k6.io/login.php', {
    redir: csrfToken,
    user: 'admin',
    pass: '123'
  });

  sleep(1);
}
```

> ⚠️ **Cảnh báo:** Nếu bạn đặt `discardResponseBodies: true` trong options, k6 sẽ không đọc được Body. Hãy dùng `{ responseType: 'text' }` cho riêng request đó để "ghi đè" cấu hình.

---

### 🔍 4. Cách 3: Trích xuất từ Chuỗi bất kỳ (XML / Text)

Khi dữ liệu không phải JSON hay HTML chuẩn (ví dụ XML hoặc một đoạn text lạ), chúng ta dùng hàm `findBetween`.

```javascript
import { findBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import http from 'k6/http';

export default function () {
  // Giả sử API trả về XML: <status>Success</status><token>ABC-123</token>
  const res = http.get('https://quickpizza.grafana.com/api/xml?color=green');

  // Trích xuất giá trị nằm giữa hai thẻ <value> và </value>
  const colorValue = findBetween(res.body, '<value>', '</value>');

  console.log(`Màu sắc trích xuất được: ${colorValue}`);
}
```

---

### 💡 5. Quy trình thực hiện Correlation chuyên nghiệp

```
1. Quay phim (Record)
   └─ Dùng Browser Recorder để xuất ra file script

2. Xác định biến động
   └─ Chạy thử script, nếu lỗi 401/403, tìm giá trị trông giống Token/ID

3. Tìm nguồn gốc
   └─ Xác định Token xuất hiện lần đầu ở Response nào của request trước

4. Viết code trích xuất
   └─ Dùng .json(), .html() hoặc findBetween để lấy giá trị ra

5. Thay thế
   └─ Thay giá trị "gắn chết" bằng biến vừa trích xuất được
```


## 🛑 Bài 2.8: Thresholds & Custom Metrics (Thiết lập "Chốt chặn" tự động)

**Mục tiêu bài học:** Biết cách tự định nghĩa một chỉ số đo lường riêng (Custom Metric). Thiết lập ngưỡng chịu lỗi (Thresholds) để k6 tự động đánh FAIL bài test nếu tỉ lệ lỗi Correlation vượt ngưỡng cho phép.

---

### 🧠 1. Tại sao k6 cần Custom Metrics cho Correlation?

Mặc định, k6 chỉ đo lường các chỉ số về hạ tầng như:
- `http_req_duration` — thời gian phản hồi
- `http_req_failed` — lỗi mạng

**Vấn đề:** Lỗi Correlation là lỗi về logic kịch bản. Server vẫn có thể trả về `Status 200` nhưng Body lại không chứa Token cần thiết — k6 vẫn tính là request thành công.

**Giải pháp:** Tạo một thước đo riêng gọi là `Rate` (Tỉ lệ) từ thư viện `k6/metrics`.

---

### 🛠️ 2. Công thức thiết lập

```
Bước 1 — Khai báo  : Tạo một biến Rate ở Init Stage
Bước 2 — Cấu hình  : Đặt ngưỡng ở phần options.thresholds
Bước 3 — Ghi nhận  : Kiểm tra giá trị trích xuất, nếu lỗi thì nạp vào Metric
```

---

### 💻 3. Code mẫu Thực chiến

Kịch bản này sẽ tự động đánh **FAIL** bài test nếu tỉ lệ lỗi trích xuất Token vượt quá **1%**.

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics'; // 1. Import thư viện Metric

// 2. Khai báo chỉ số đo lường lỗi Correlation
const correlationFailRate = new Rate('correlation_errors');

export const options = {
  vus: 10,
  duration: '10s',
  thresholds: {
    // 3. THIẾT LẬP NGƯỠNG (SLA):
    // Bài test sẽ bị đánh FAIL nếu tỉ lệ lỗi trích xuất > 1% (0.01)
    'correlation_errors': ['rate < 0.01'],
    'http_req_duration': ['p(95) < 500'], // 95% request phải dưới 500ms
  },
};

export default function () {
  const res = http.get('https://quickpizza.grafana.com/api/doughs');

  // TRÍCH XUẤT THỬ
  const doughs = res.json().doughs;

  // KIỂM TRA LOGIC
  // Nếu mảng doughs không tồn tại hoặc rỗng, ta coi là lỗi Correlation
  const isSuccess = (doughs && doughs.length > 0);

  // 4. GHI NHẬN VÀO METRIC
  // .add(true) là có lỗi, .add(false) là thành công
  correlationFailRate.add(!isSuccess);

  check(res, {
    'Trích xuất dữ liệu thành công': () => isSuccess,
  });

  if (isSuccess) {
    const doughId = doughs[0].ID;
    http.get(`https://quickpizza.grafana.com/api/doughs/${doughId}`);
  }

  sleep(1);
}
```

---

### 📊 4. Cách đọc kết quả trên Terminal

| Ký hiệu | Ý nghĩa |
|---|---|
| ✅ **Dấu tích xanh** | Tỉ lệ lỗi trích xuất nằm trong giới hạn cho phép |
| ❌ **Dấu nhân đỏ** | Bài test bị đánh FAIL — logic kịch bản đã hỏng dù server phản hồi nhanh |

> 💡 **Mẹo chuyên gia:** Trong môi trường CI/CD (Jenkins, GitHub Actions), khi gặp dấu ✗, k6 sẽ trả về **Exit Code 1**, lập tức dừng Pipeline và ngăn các bản code lỗi được đưa lên môi trường thật.

---

### ⚠️ 5. Lưu ý quan trọng

**Phân biệt Lỗi Mạng và Lỗi Logic:**
- `http_req_failed` — chỉ báo lỗi khi Server sập (4xx, 5xx)
- Custom `Rate` — giám sát các bước logic quan trọng như Lấy Token, Thanh toán thành công, v.v.

**Ngưỡng nghiêm ngặt:** Đối với Correlation, thông thường đặt ngưỡng cực thấp:
```
rate < 0.001  →  chỉ cho phép lỗi 1 phần nghìn
```
Vì đây là "xương sống" của toàn bộ bài test.

---

### 📝 Tóm tắt

| Khái niệm | Vai trò |
|---|---|
| **Custom Metrics** | Đo lường những thứ "vô hình" như logic code |
| **Thresholds** | Trọng tài đưa ra phán quyết Pass/Fail tự động |
| **Rate** | Loại metric dùng để theo dõi tỉ lệ lỗi Correlation |

---

### 📚 Nguồn tham khảo

- [k6 Docs: Correlation & Dynamic Data](https://grafana.com/docs/k6/latest/examples/correlation-and-dynamic-data/)
- [k6 API: Response.json()](https://grafana.com/docs/k6/latest/javascript-api/k6-http/response/response-json/)
- [k6 Utils: findBetween](https://grafana.com/docs/k6/latest/javascript-api/jslib/utils/findbetween/)

---
---