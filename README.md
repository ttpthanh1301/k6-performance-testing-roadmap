# 🚀 Modern Performance Testing with k6: The Ultimate Roadmap

> **A step-by-step learning roadmap for Performance Engineering using k6, transitioning from GUI-based tools (like JMeter) to a modern "Everything as Code" approach.**

Repository này được thiết kế dành cho QA/Automation Engineer muốn xây dựng tư duy lập trình trong kiểm thử hiệu năng, làm chủ công cụ k6 trong kỷ nguyên Cloud Native và CI/CD.

---
## 📖 Table of Contents

- [Về k6](#ve-k6)
- [Kiến thức yêu cầu](#kien-thuc-yeu-cau-prerequisites)
- [Lộ trình học tập](#lo-trinh-hoc-tap)
- [Capstone Project](#capstone-project)
---

## 📌 Quy ước link bài học

- Mỗi bài học gồm:
  - 📖 Mô tả kiến thức
  - 🔗 Link GitHub (click để mở code/tài liệu)

---

## Về k6

**Grafana k6** là công cụ Load Test mã nguồn mở hiện đại, tối ưu cho Developer và QA. Nó sử dụng Go để đạt hiệu năng cao và JavaScript/TypeScript để viết script, giúp tích hợp CI/CD dễ dàng.

---

## Kiến thức yêu cầu (Prerequisites)

- Kiến thức cơ bản về HTTP/HTTPS, DNS, latency
- JavaScript (ES6+)
- REST API & JSON
- Command line cơ bản

---

## 🗺️ Lộ trình học tập

### 🟢 Phase 1: Nền tảng & Tư duy Code-based (⏱ 1 tuần)

**Mục tiêu:** Hiểu bản chất performance testing hiện đại

- **Bài 1.1: k6 là gì? Tư duy Performance as Code**  
  Hiểu tại sao k6 đang thay thế các tool GUI như JMeter  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-1/lesson-1)

- **Bài 1.2: So sánh JMeter vs k6 vs Gatling vs Locust**  
  So sánh ưu nhược điểm các tool  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-1/lesson-2)

- **Bài 1.3: Metrics cơ bản (Latency, p95, p99, throughput)**  
  Hiểu các chỉ số hiệu năng quan trọng  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-1/lesson-3)

- **Bài 2.1: Cài đặt k6 (local + Docker)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-1/lesson-4)

- **Bài 2.2: Setup IDE (VS Code + extension)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-1/lesson-5)

- **Bài 2.3: Hello World & lifecycle k6**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-1/lesson-6)

---

### 🟡 Phase 2: Kỹ thuật Scripting Thực chiến (⏱ 2 tuần)

**Mục tiêu:** Thành thạo scripting

- **Lifecycle nâng cao (Init / Setup / VU / Teardown)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-2/lifecycle)

- **HTTP Mastery (GET, POST, headers, params)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-2/http)

- **Authentication (JWT, OAuth2)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-2/auth)

- **Data Driven Testing (CSV/JSON)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-2/data)

- **Correlation (dynamic data)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-2/correlation)

- **Error Handling & Retry Logic**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-2/error-handling)

---

### 🟠 Phase 3: Chiến lược Test & Phân tích (⏱ 2 tuần)

**Mục tiêu:** Thiết kế test thực tế

- **Các loại test: Smoke / Load / Stress / Spike / Soak**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-3/test-types)

- **Executors & Scenarios**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-3/scenario)

- **Thresholds (SLO / pass fail)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-3/thresholds)

- **Custom Metrics**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-3/metrics)

- **Phân tích bottleneck + Grafana dashboard**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-3/analysis)

---

### 🔵 Phase 4: Mở rộng hệ sinh thái k6 (⏱ 3 tuần)

**Mục tiêu:** Test UI + realtime

- **k6 Browser (UI testing)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-4/browser)

- **Web Vitals (LCP, CLS, INP)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-4/web-vitals)

- **WebSocket / Realtime testing**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-4/websocket)

- **TypeScript setup**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-4/typescript)

---

### 🟣 Phase 5: Enterprise & CI/CD (⏱ 2 tuần)

**Mục tiêu:** Đưa k6 vào production

- **Cấu trúc project chuẩn (monorepo)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-5/structure)

- **CI/CD (GitHub Actions, GitLab, Jenkins)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-5/ci-cd)

- **Distributed testing (Kubernetes)**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-5/k8s)

- **Alerting & Performance regression**  
  👉 [Xem bài học](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/phase-5/alerting)

---

## 🏆 Capstone Project

**Mục tiêu:** Áp dụng toàn bộ kiến thức

- Mô phỏng luồng e-commerce (Browse → Cart → Checkout)
- Kết hợp API + UI test
- Setup threshold
- Chạy CI/CD

👉 [Xem project](https://github.com/ttpthanh1301/k6-performance-testing-roadmap/tree/main/capstone)

---

## 🤝 Contribution

Mọi đóng góp đều được hoan nghênh!

---

## 📄 License

MIT License

---

🔥 *Happy Performance Testing!* 🚀
