# Health Trend Automation System

Hệ thống tự động thu thập xu hướng sức khỏe và tạo script viral hàng ngày.

## 📁 Cấu trúc

```
health-trend-automation/
├── database/
│   ├── db.js           # Database SQLite
│   └── data/
│       └── trends.db  # File database
├── crawlers/
│   └── trendCrawler.js # Module cào dữ liệu
├── scripts/
│   └── scriptGenerator.js # Tạo script tự động
├── reports/
│   └── dailyReport.js  # Tạo báo cáo hàng ngày
├── scheduler/
│   └── dailyScheduler.js # Lên lịch tự động
└── index.js            # Main entry
```

## 🚀 Cách sử dụng

### Chạy toàn bộ hệ thống (crawl + generate + report)
```bash
node index.js full
```

### Chạy từng phần
```bash
node index.js crawl      # Cào dữ liệu xu hướng
node index.js generate  # Tạo script
node index.js report    # Tạo báo cáo
```

### Xem kết quả
```bash
node index.js view-report   # Xem báo cáo hôm nay
node index.js view-scripts # Xem script đã tạo
```

### Lên lịch chạy tự động mỗi ngày (6 AM)
```bash
node index.js schedule
```

## 📊 Kết quả test hôm nay (14/03/2026)

- **Trends thu thập:** 16
- **Scripts tạo:** 5
- **Hot Topics:**
  1. health tips
  2. fitness
  3. weight loss
  4. diet
  5. MentalHealth

## 🔧 Tùy chỉnh

### Thay đổi giờ chạy tự động
Trong `scheduler/dailyScheduler.js`:
```javascript
const SCHEDULE_TIME = '0 6 * * *'; // 6 AM hàng ngày
// Format: 'phút giờ * * *'
```

### Thay đổi phong cách script
Trong `scripts/scriptGenerator.js`:
```javascript
const STYLE_GUIDE = {
  tone: 'aggressive, confrontational, dark humor',
  keywords: ['bitch-ass', 'dumb-ass', 'fuck', 'fat ass'],
  // ...
};
```

## 📝 Yêu cầu

- Node.js v16+
- Không cần cài đặt thêm gì (đã có SQLite)
