# Bài 1.1: k6 là gì?

## 🎯 Mục tiêu
- Hiểu k6 là gì
- Hiểu Performance as Code

## 📚 Nội dung
- Giới thiệu k6
- So sánh với JMeter

## 💻 Example

```javascript
import http from 'k6/http';

export default function () {
  http.get('https://test.k6.io');
}