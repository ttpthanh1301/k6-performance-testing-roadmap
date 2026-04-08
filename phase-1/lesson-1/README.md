# Bài 1.1: Giới thiệu k6 & Phương pháp luận Performance as Code (PaC)

> **Mục tiêu bài học:** Hiểu rõ bản chất của công cụ kiểm thử hiệu năng k6, kiến trúc lõi của nó và tư duy chuyển dịch sang mô hình "Performance as Code" trong phát triển phần mềm hiện đại.

---

## 🚀 1. Grafana k6 là gì?

Theo định nghĩa chính thức từ trang chủ, **Grafana k6** là một công cụ kiểm thử tải (load testing) mã nguồn mở, cực kỳ dễ sử dụng. Nó giúp các nhóm kỹ sư đánh giá hiệu năng hệ thống và phát hiện sớm các vấn đề trước khi ứng dụng được đưa lên môi trường thực tế (Production).

k6 được thiết kế với tư duy đặt **Trải nghiệm lập trình viên (Developer Experience - DX)** lên hàng đầu, thể hiện qua hai đặc điểm cốt lõi:

- **Lõi (Engine) hiệu năng cao viết bằng Go (Golang):** Khác với các công cụ đời cũ dựa trên OS Threads (luồng hệ điều hành) hay Java JVM rất tốn RAM, k6 cấp phát mỗi Virtual User (Người dùng ảo) trên một _Goroutine_. Kiến trúc này giúp k6 tiêu thụ tài nguyên cực thấp. Chỉ với một máy tính bình thường, k6 có thể mô phỏng từ **30.000 đến 40.000** người dùng đồng thời mà không gặp lỗi _"Out of Memory"_.
- **Kịch bản kiểm thử (Scripts) viết bằng JavaScript (ES6+):** Mặc dù lõi được viết bằng Go để tối ưu hiệu suất, k6 lại yêu cầu người dùng viết kịch bản test bằng JavaScript. Điều này mang lại sự thân thiện, linh hoạt và dễ tiếp cận cho đại đa số lập trình viên hiện nay.

### 🎯 Định vị của Grafana đối với k6

1. **Văn hóa hợp tác (Cross-Functional):** Phá vỡ rào cản truyền thống giữa QA và DEV. Nhờ sử dụng JavaScript, mọi thành viên trong đội ngũ kỹ sư đều có thể dễ dàng đọc, viết và cùng đóng góp vào kịch bản test.
2. **Tích hợp CI/CD tự động:** k6 là một file thực thi (binary) độc lập, không có external dependencies (không cần cài đặt Java, Python hay Node.js). Điều này giúp k6 tích hợp hoàn hảo và gọn nhẹ vào bất kỳ pipeline nào như GitHub Actions, GitLab CI, hay Jenkins.
3. **Tư duy Shift-Left Testing:** Chuyển dịch việc kiểm thử hiệu năng lên các giai đoạn sớm hơn và thực hiện thường xuyên trong vòng đời phát triển phần mềm, thay vì để đến khâu cuối cùng mới làm như các quy trình truyền thống.

---

## 💻 2. Performance as Code (PaC) là gì?

> **Định nghĩa:** Performance as Code (PaC) là một phương pháp luận trong đó các kịch bản kiểm thử hiệu năng (load testing scripts), cấu hình môi trường, và các ngưỡng chấp nhận (SLOs, SLAs) được viết bằng các **ngôn ngữ lập trình có thể đọc được bởi con người** (như JavaScript, Python, Scala) thay vì cấu hình qua giao diện đồ họa (GUI).

### Sự khác biệt cốt lõi

Trong mô hình PaC, code kiểm thử hiệu năng được đối xử **giống hệt như code của ứng dụng**:

- Lưu trữ trên hệ thống quản lý phiên bản (Git).
- Được đánh giá thông qua quy trình Review Code (Pull Request).
- Tự động thực thi trong các đường ống CI/CD.

### SLAs/SLOs as Code (Ngưỡng hiệu năng bằng Code)

Với PaC, bạn không cần phải nhìn bằng mắt vào các biểu đồ tĩnh để đoán xem bài test Pass hay Fail. Bạn sẽ định nghĩa thẳng các tiêu chí thất bại (Thresholds) trực tiếp vào mã nguồn.

**Ví dụ:** Thay vì nói chung chung "Hệ thống phải chạy nhanh", bạn định nghĩa bằng code:

> _"Nếu 95% request (p95) phản hồi chậm hơn 500ms, hoặc tỉ lệ lỗi > 1%, thì đánh rớt (fail) quá trình build (pipeline) này ngay lập tức."_

### Tích hợp hệ sinh thái "Everything as Code"

PaC hiếm khi đứng một mình. Nó thường được kết hợp chặt chẽ với **Infrastructure as Code** (IaC - ví dụ: Terraform) để tự động hóa toàn bộ quy trình:

1. Tự động tạo môi trường test.
2. Chạy code PaC để giả lập tải.
3. Tự động xóa môi trường sau khi test xong để tiết kiệm chi phí Cloud.

---

## 📚 3. Tài liệu tham khảo

Để hiểu sâu hơn về PaC và tự động hóa hiệu năng, bạn có thể tham khảo các tài liệu chuyên ngành sau:

- **O'Reilly Media:** Các cuốn sách như _"Continuous API Management"_ hoặc _"Systems Performance"_ (của Brendan Gregg) đề cập rất sâu về tự động hóa hiệu năng.
- **ThoughtWorks:** Tổ chức tiên phong về Agile/DevOps, thường xuyên nhắc đến thuật ngữ _Performance testing as code_ trong các báo cáo _Technology Radar_.
- **Tài liệu chính thức từ Grafana k6:** Trang [k6.io/docs](https://k6.io/docs/) cung cấp định nghĩa chuẩn mực và thực tiễn nhất về PaC trên thị trường hiện nay.
- **Google Cloud / AWS:** Các tài liệu (Architecture Center / Well-Architected Framework) về best-practice cho việc tích hợp kiểm thử hiệu năng tự động (Shift-left testing) vào quy trình phát triển đám mây.
