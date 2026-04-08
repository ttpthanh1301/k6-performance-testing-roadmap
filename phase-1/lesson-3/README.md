# Bài 1.3: Các Metrics cơ bản & Giải mã Output k6 (Latency, p95, p99, Throughput)

> **Mục tiêu bài học:** Nắm vững ý nghĩa của các chỉ số hiệu năng cốt lõi (Latency, p95, Throughput). Biết cách "đọc vị" kết quả trên Terminal của k6 để biết hệ thống đang ở đâu so với SLA định trước, từ đó cấu hình tự động hóa chính xác.

---

## 📖 1. Hiểu các chỉ số hiệu năng (Metrics) cốt lõi

### 1.1. Thời gian phản hồi (Latency / Response Time)
Đây là nhóm chỉ số cho biết hệ thống của bạn trả lời nhanh hay chậm.
* **Sự lừa dối của "Trung bình" (Average - `avg`):** Trong load test, chỉ số trung bình (avg) **chỉ mang tính chất tham khảo**. Nó dễ bị làm lệch bởi các requests quá nhanh hoặc quá chậm (outliers) và không đại diện cho trải nghiệm thực tế của số đông.
* **Chân lý của Load Test - Phân vị (Percentiles - `p90`, `p95`, `p99`):** * Định nghĩa: `p95 = 250ms` nghĩa là **95%** số requests hoàn thành dưới 250ms. 
  * Đây là **chỉ số SLA quan trọng nhất**. Nó giúp bạn nhìn thấy rõ "trải nghiệm của những người dùng tồi tệ nhất". Đảm bảo p95 và p99 thấp đồng nghĩa với việc đại đa số khách hàng đều thấy ứng dụng chạy mượt mà.

### 1.2. Khả năng chịu tải (Throughput & Concurrency)
* **Thông lượng (Throughput - RPS):** Số lượng requests mà hệ thống xử lý thành công trong 1 giây (Requests Per Second). 
* **Đồng thời (Concurrency - VUs):** Số lượng người dùng ảo (Virtual Users) đang cùng lúc tương tác với hệ thống. *(Lưu ý: 10 VUs có thể tạo ra 100 RPS nếu mỗi VU gửi 10 requests/giây).*

### 1.3. Độ ổn định (Reliability)
* **Tỉ lệ lỗi (Error Rate):** Tỉ lệ phần trăm các requests thất bại (HTTP 5xx, Timeout). Một bài test lý tưởng phải có error rate ở mức `0.00%`.

---

## 🖥 2. Giải mã Output k6 (Biết hệ thống đang ở đâu)

Khi một kịch bản k6 kết thúc, Terminal sẽ in ra một bảng tóm tắt (Summary Results). Dưới đây là cách giải thích các thông số quan trọng nhất:

**Khối TOTAL RESULTS (Kết quả tổng quan)**
* **`http_req_duration` (Tổng thời gian phản hồi HTTP):**
  * `avg=134.38ms` ➔ Trung bình phản hồi. Chỉ tham khảo, không phải SLA.
  * `p(95)=256.26ms` ➔ **★ SLA quan trọng nhất.** Hiểu là: 95% request hoàn thành dưới mức 256.26ms ➔ Hệ thống PASS.
* **`http_req_failed` (Tỉ lệ lỗi HTTP):**
  * Hiển thị `0.00%` ➔ Hoàn hảo! Không có request nào bị lỗi.
  * *Lưu ý:* Nếu chỉ số này `> 1%`, hệ thống đang có vấn đề nghiêm trọng (quá tải, nghẽn DB, hoặc chết server).
* **`http_reqs` (Thông lượng):** * Hiển thị `6 (1.08705/s)` ➔ Đã gửi tổng cộng 6 requests, tốc độ trung bình là ~1.1 request mỗi giây (RPS).

**Khối EXECUTION (Thực thi kịch bản)**
* **`iterations` (Vòng lặp):**
  * Hiển thị `3 (0.54/s)` ➔ Kịch bản chính (default function) đã chạy hoàn tất 3 lần. (Ví dụ: 3 lần gọi / 5 giây = ~0.6 RPS).
* **`vus` (Người dùng ảo):**
  * Hiển thị `1` ➔ Có 1 người dùng ảo đang thực thi kịch bản này.

---

## 🎯 3. Tiêu chuẩn SLA & Chuyển hóa thành Code (Thresholds)

### Tiêu chuẩn SLA tham khảo trong ngành
Tùy thuộc vào domain, bạn có thể áp dụng các mốc SLA sau:
* **Microservices / Internal APIs:** `p95 < 100ms`, Lỗi `< 0.1%`
* **Public REST APIs:** `p95 < 300ms`, Lỗi `< 1%`
* **Hệ thống thanh toán:** `p95 < 500ms`, Lỗi `0.00%` (Tuyệt đối không lỗi)

### Cấu hình Thresholds trong k6 (SLA as Code)
Để tự động hóa việc đánh giá Pass/Fail (ví dụ: dùng cho CI/CD Pipeline), bạn cấu hình thẳng các chỉ số ở phần 2 vào block `options.thresholds` trong code k6:

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    // 1. Tỉ lệ lỗi (http_req_failed) phải nhỏ hơn 1% (0.01)
    http_req_failed: ['rate<0.01'], 
    
    // 2. Thời gian phản hồi (http_req_duration): 95% request phải < 300ms
    http_req_duration: ['p(95)<300'], 
  },
};

export default function () {
  http.get('[https://test.k6.io](https://test.k6.io)');
  sleep(1);
}

# Phụ lục Chuyên sâu: Toàn cảnh về SLA, SLO, SLI và Cách thiết lập hiệu quả

> **Mở đầu:** Trong phát triển phần mềm hiện đại, hiệu năng không chỉ là những con số kỹ thuật khô khan mà là **lời cam kết kinh doanh**. Việc hiểu sâu về SLA (dưới góc nhìn của ITSM) giúp đội ngũ Dev/QA không chỉ viết test script đúng, mà còn mang lại giá trị thực tế cho doanh nghiệp.

---

## 🤝 1. Bản chất của SLA và SLC

* **SLA (Service Level Agreement - Thỏa thuận mức dịch vụ):** Là một bản hợp đồng có tính **hai chiều** giữa Nhà cung cấp và Khách hàng. Nó quy định rõ phạm vi, tiêu chuẩn chất lượng (nhanh ra sao, ổn định thế nào) và các hình phạt/bồi thường (Penalty/Indemnification) nếu vi phạm.
* **SLC (Service Level Commitment - Cam kết mức dịch vụ):** Rộng hơn SLA nhưng mang tính **một chiều**. Nó chỉ đơn thuần là lời tuyên bố của nhà cung cấp về những gì họ đảm bảo, không có ràng buộc đền bù khắt khe như SLA.

### 🏢 3 Loại hình SLA phổ biến:
1. **SLA theo khách hàng (Customer-level SLA):** Thỏa thuận "may đo" riêng cho một khách hàng VIP cụ thể (VD: Khách hàng Enterprise được hỗ trợ 1-kèm-1 trong 15 phút).
2. **SLA theo dịch vụ (Service-level SLA):** Mức cam kết chung cho mọi khách hàng dùng chung một sản phẩm (VD: Mọi người dùng Gmail đều được cam kết uptime 99.9%).
3. **SLA nhiều cấp (Multilevel SLA):** Chia thành nhiều hạng mức dịch vụ khác nhau trong cùng một tổ chức (VD: Gói Free, Gói Basic, Gói Premium).

---

## 🏛 2. Tách bạch SLA, SLO và SLI (Chuẩn DevOps / SRE)

Để quản lý SLA hiệu quả, đội ngũ kỹ thuật không dùng trực tiếp hợp đồng SLA để đo đạc, mà chia nhỏ nó thành SLO và SLI:

| Khái niệm | Ý nghĩa | Ví dụ thực tế | Trách nhiệm chính |
| :--- | :--- | :--- | :--- |
| **SLA** (Agreement) | **Hợp đồng kinh doanh** (Có đền bù nếu vi phạm). | Uptime < 99.9% ➔ Hoàn tiền 10% cho KH. | Kinh doanh, Pháp lý |
| **SLO** (Objective) | **Mục tiêu kỹ thuật nội bộ** (Luôn khắt khe hơn SLA để làm vùng đệm). | Đội Dev tự đặt mục tiêu Uptime phải đạt 99.95%. | Product, Tech Lead |
| **SLI** (Indicator) | **Chỉ số đo lường thực tế** (Hệ thống đang chạy ra sao?). | Dashboard báo Uptime tháng này đang là 99.98%. | Dev, QA, SRE |

---

## 📊 3. Các chỉ số (Metrics) cốt lõi trong SLA & Cách k6 đo lường

Từ các chỉ số quản trị của doanh nghiệp, chúng ta có thể "map" (ánh xạ) trực tiếp sang các chỉ số trong kiểm thử hiệu năng (k6):

1. **Uptime & Availability (Tính sẵn sàng):** * *Kinh doanh:* Hệ thống phải hoạt động 99.9% thời gian trong tháng.
   * *Test k6:* Sử dụng k6 chạy các bài test chịu tải dài hạn (Soak Testing) để xem hệ thống có bị "sập" (downtime) khi chạy liên tục hay không.
2. **Error Rate (Tỷ lệ lỗi):**
   * *Kinh doanh:* Tỷ lệ giao dịch thất bại không được vượt quá 1%.
   * *Test k6:* Tương ứng với metric `http_req_failed`. Cấu hình Threshold: `http_req_failed: ['rate<0.01']`.
3. **Response Time (Thời gian phản hồi):**
   * *Kinh doanh:* 95% khách hàng truy cập web phải thấy trang load dưới 2 giây.
   * *Test k6:* Tương ứng với metric `http_req_duration`. Cấu hình Threshold: `http_req_duration: ['p(95)<2000']`.
4. **Capacity / Throughput (Sức chứa - Bổ sung cho Load Test):**
   * *Kinh doanh:* Hệ thống phải chịu được chương trình Flash Sale với 10,000 người mua cùng lúc mà không vi phạm các SLA ở trên.
   * *Test k6:* Cấu hình `vus: 10000` (10 ngàn Virtual Users) và kiểm tra xem Uptime, Error Rate, Response Time có giữ vững không.

*(Lưu ý: Các chỉ số như MTTR - Thời gian khôi phục, hay Resolution Time thuộc về khâu Vận hành & Xử lý sự cố, thường được đo bằng các tool monitoring như Prometheus/Grafana thay vì tool load test).*

---

## ⚙️ 4. Best Practices: Quản lý và Tự động hóa SLA

Để SLA không chỉ là "tờ giấy cất trong tủ", doanh nghiệp cần áp dụng các thực hành sau:

1. **Tiêu chuẩn SMART:** SLA phải Cụ thể, Đo lường được, Khả thi, Liên quan và Có thời hạn. Đừng đặt SLA kiểu "hệ thống phải chạy rất nhanh".
2. **Đồng bộ với Business:** Nếu mục tiêu của công ty quý này là "Giữ chân khách hàng", hãy siết chặt SLA về *Thời gian phản hồi* và *Tỷ lệ lỗi*.
3. **Minh bạch & Cập nhật định kỳ:** Lượng User tăng lên mỗi năm, SLA không thể đứng im. Cần review lại SLA/SLO mỗi quý.
4. **Shift-Left Testing (Kiểm thử từ sớm):** Không đợi lên Production mới biết vi phạm SLA. Hãy đưa kịch bản k6 (chứa các SLO Thresholds) chạy tự động trong CI/CD pipeline mỗi khi Dev push code mới.
5. **Ứng dụng Công nghệ:** Tự động hóa việc theo dõi bằng hệ sinh thái:
   * **k6:** Dùng để giả lập tải và đánh giá SLA trước khi Release.
   * **Grafana + Prometheus:** Dùng để làm Dashboard theo dõi SLA/SLI realtime trên Production và cảnh báo (Alert) cho Dev ngay khi có dấu hiệu vi phạm.