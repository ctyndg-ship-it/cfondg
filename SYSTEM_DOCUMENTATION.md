# Health Trend Automation System - Complete Documentation

## 📋 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HEALTH TREND AUTOMATION SYSTEM v2.0                     │
└─────────────────────────────────────────────────────────────────────────────┘

                              USER INTERFACE
                    (Dashboard + Telegram Notifications)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SCHEDULER (node-schedule)                         │
│                    Runs 3x/day: 6AM, 12PM, 6PM                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   CRAWLER LAYER   │   │    SCRIPT          │   │    REPORT        │
│   (trendCrawler)  │   │    GENERATOR       │   │    GENERATOR     │
│                   │   │   (scriptGenerator)│   │  (dailyReport)   │
│ - Reddit          │   │                    │   │                  │
│ - News RSS        │   │ - AI (GPT-4)      │   │ - HTML Export    │
│ - Google Trends   │   │ - Template Fallback│   │ - DOCX Export   │
│ - TikTok          │   │                    │   │ - Telegram Send  │
│ - YouTube         │   │                    │   │                  │
└───────────────────┘   └───────────────────┘   └───────────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (SQL.js)                                 │
│                                                                          │
│   trends ────────── scripts ────────── daily_reports                     │
│   settings ────────── style_guide                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FULL AUTOMATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

1. SCHEDULER TRIGGERS (6AM / 12PM / 6PM)
         │
         ▼
2. runFullAutomation()
         │
    ┌────┴────┐
    ▼         ▼
3a. runAllCrawlers()          3b. generateAllScripts()
    │                              │
    ▼                              ▼
 Reddit API                   OpenAI GPT-4
 News RSS                     (or template)
 Google Trends                │
    │                              │
    └──────────┬─────────────────┘
               ▼
4. saveTrendsToDatabase()
               │
               ▼
5. generateDailyReport()
               │
        ┌──────┴──────┐
        ▼               ▼
  HTML Export         DOCX Export
        │               │
        └───────┬───────┘
                ▼
6. sendTelegramReport()
                │
                ▼
7. User receives DOCX file on Telegram
```

---

## 📁 File Structure

```
health-trend-automation/
├── index.js                     # Main CLI entry point
├── config.json                  # System configuration
├── package.json                 # Dependencies
├── Dockerfile                   # Docker build
├── docker-compose.yml           # Docker compose
│
├── crawlers/
│   ├── trendCrawler.js         # Main crawler (Reddit, News, Google, TikTok)
│   └── trendAnalyzer.js         # Trend analysis & clustering
│
├── scripts/
│   └── scriptGenerator.js        # AI script generation with GPT-4
│
├── reports/
│   └── dailyReport.js           # HTML & DOCX report generation
│
├── scheduler/
│   └── dailyScheduler.js        # Cron scheduler (6AM, 12PM, 6PM)
│
├── dashboard/
│   ├── server.js                # Express API server
│   └── public/
│       └── index.html           # React-style Dashboard UI
│
├── database/
│   └── db.js                   # SQL.js database
│
├── pipeline/
│   └── videoPipeline.js         # Video generation pipeline
│
├── utils/
│   ├── configManager.js        # Config loader
│   ├── logger.js               # Logger
│   ├── backup.js               # Backup utilities
│   └── notifications.js         # Telegram notifications
│
└── reports/output/              # Generated reports (HTML, DOCX)
```

---

## 🗄️ Database Schema

### trends table
```sql
CREATE TABLE trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_name TEXT NOT NULL,        -- Trend title
  category TEXT NOT NULL,         -- 'health'
  source TEXT NOT NULL,           -- 'reddit', 'news', 'google_trends', 'tiktok', 'youtube'
  source_url TEXT,                -- Original URL
  engagement_score INTEGER,       -- 0-100 (upvotes/comments)
  growth_rate REAL,               -- 0-100 (viral velocity)
  description TEXT,                -- Metadata description
  discovered_at DATETIME,         -- When discovered
  collected_date DATE,            -- Date collected
  status TEXT DEFAULT 'new'       -- 'new', 'processed'
);
```

### scripts table
```sql
CREATE TABLE scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trend_id INTEGER,              -- FK to trends
  topic_name TEXT NOT NULL,       -- Topic title
  full_script TEXT NOT NULL,      -- Generated script content
  hashtags TEXT,                  -- #health #tips etc
  source_link TEXT,               -- Source URL
  duration INTEGER DEFAULT 30,     -- Video duration (seconds)
  status TEXT DEFAULT 'draft',    -- 'draft', 'generated', 'video_ready'
  notes TEXT,                     -- Notes
  generated_at DATETIME,          -- When generated
  updated_at DATETIME             -- Last update
);
```

### daily_reports table
```sql
CREATE TABLE daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date DATE UNIQUE,        -- Report date
  total_trends INTEGER,           -- Trends count
  hot_topics TEXT,                -- JSON array of topics
  generated_scripts INTEGER,       -- Scripts count
  report_content TEXT,             -- Full HTML content
  created_at DATETIME
);
```

### settings table
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,           -- Setting key
  value TEXT,                      -- Setting value
  updated_at DATETIME
);
```

### style_guide table
```sql
CREATE TABLE style_guide (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,             -- Style name
  tone TEXT,                      -- Tone (aggressive, etc)
  keywords TEXT,                   -- Keywords
  structure TEXT,                  -- Script structure
  sample_content TEXT,            -- Example
  is_active INTEGER DEFAULT 1,
  created_at DATETIME
);
```

---

## 🔗 API Endpoints (Dashboard Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Get dashboard statistics |
| `/api/trends` | GET | Get all trends (with filters) |
| `/api/scripts` | GET | Get all scripts |
| `/api/reports` | GET | Get all generated reports |
| `/api/sources` | GET | Get trends by source |
| `/api/run-full` | POST | Run full automation |
| `/api/generate-report` | POST | Generate daily report |
| `/api/crawl` | POST | Run crawlers only |
| `/api/scripts` | POST | Create new script |
| `/api/scripts/:id` | DELETE | Delete script |
| `/api/set-telegram` | POST | Configure Telegram |
| `/api/telegram-help` | GET | Telegram setup guide |

---

## ⚙️ Configuration (config.json)

```json
{
  "system": {
    "logLevel": "info",           // debug, info, warn, error
    "scheduleTime": "0 6 * * *", // Cron: 6AM daily
    "autoRun": true,              // Enable auto-run
    "maxTrendsPerDay": 50,        // Max trends to collect
    "maxScriptsPerDay": 10        // Max scripts to generate
  },
  "crawler": {
    "sources": ["reddit", "news", "google_trends", "tiktok"],
    "minEngagementScore": 30,     // Minimum score to keep
    "languages": ["en"],
    "categories": ["health", "fitness", "nutrition", "mental_health"]
  },
  "script": {
    "useAI": true,                // Use GPT-4 or template fallback
    "aiModel": "gpt-4o-mini",    // OpenAI model
    "defaultDuration": 30,        // Video duration in seconds
    "tone": "aggressive",        // Script tone
    "maxRetries": 3              // API retry attempts
  },
  "notifications": {
    "enabled": true,
    "telegram": {
      "botToken": "YOUR_TOKEN",
      "chatId": "YOUR_CHAT_ID"
    }
  }
}
```

---

## 🎯 Crawler Sources

### 1. Reddit Crawler
- **Subreddits**: health, fitness, nutrition, loseit, Biohackers, Supplements, Longevity, Nootropics, Sleep
- **Feed Types**: rising (priority), hot
- **Filters**:
  - Min upvotes: 50
  - Min comments: 10
  - Max age: 72 hours
  - Exclude: memes, jokes, diaries, rants

### 2. News Crawler (RSS)
- **Sources**:
  - BBC Health: `https://feeds.bbci.co.uk/news/health/rss.xml`
  - NY Times Health: `https://rss.nytimes.com/services/xml/rss/nyt/Health.xml`
  - US News Health: `https://health.usnews.com/rss/health`

### 3. Google Trends
- **Endpoint**: `https://trends.google.com/trends/api/dailytrends`
- **Geo**: US

### 4. TikTok (Limited)
- **Endpoint**: TikTok Discover API (often blocked)
- **Fallback**: Search term queries

### 5. YouTube (Limited)
- **Requires**: YouTube Data API key
- **Fallback**: Search queries

---

## 🤖 Script Generator

### AI Prompt Structure
```
[HOOK - 5 seconds]
Shocking fact or question about topic

[EXPLAIN - 30 seconds]
What it is, key facts, who it affects

[WARNING SIGNS - 20 seconds]
3-5 specific warning signs

[WHAT TO DO - 20 seconds]
2-3 evidence-based recommendations

[DISCLAIMER - 5 seconds]
"Consult your doctor"

[CTA]
"Follow for more science-based health info"
```

### Tone: Aggressive/Vulgar
- Keywords: 'bitch-ass', 'dumb-ass', 'fuck', 'fat ass', etc.
- Style: Confrontational, dark humor, unapologetic

### Hashtag Generation
- Extracts keywords from topic
- Adds general health tags: #health, #healthtips, #wellness

---

## 📅 Scheduling

### Cron Expression
```
'0 6 * * *'  → 6:00 AM daily
'0 12 * * *' → 12:00 PM daily  
'0 18 * * *' → 6:00 PM daily
```

### Manual Commands
```bash
node index.js dashboard      # Start dashboard with scheduler
node index.js full         # Run everything now
node index.js crawl         # Crawl data only
node index.js generate     # Generate scripts only
node index.js schedule     # Schedule only
```

---

## 📱 Telegram Integration

### Setup
1. Create bot via @BotFather
2. Get Chat ID via @userinfobot or API
3. Configure in config.json or via `/api/set-telegram`

### Notification Content
- Stats summary (trends, scripts, reports count)
- DOCX report file attachment
- Link to dashboard

---

## 📊 Report Generation

### HTML Report
- Full styled report with tables
- Charts for top trends
- Script previews
- Exportable

### DOCX Report
- Word document format
- Tables for trends
- Script content
- Openable on PC and mobile

---

## 🚀 Deployment (Docker)

```bash
# Build
docker build -t health-trend-automation .

# Run
docker run -d -p 3000:3000 \
  -v $(pwd)/database/data:/app/database/data \
  -v $(pwd)/reports/output:/app/reports/output \
  health-trend-automation

# Or use docker-compose
docker-compose up -d
```

---

## 🔧 Troubleshooting

### Common Issues

1. **No trends found**
   - Check Reddit API rate limiting
   - Verify health keywords in config

2. **Script generation fails**
   - Check OpenAI API key
   - Fallback to template mode

3. **Telegram not working**
   - Verify bot token and chat ID
   - Check if bot is started

4. **Reports not showing**
   - Check /reports/output directory permissions
   - Verify database is initialized

---

## 📝 Environment Variables

```env
OPENAI_API_KEY=sk-...      # OpenAI API key
PORT=3000                  # Server port
TZ=Asia/Ho_Chi_Minh       # Timezone
LOG_LEVEL=info            # Log level
SCHEDULE_TIME=0 6 * * *    # Cron schedule
```

---

## 🔄 GitHub Repository

- **URL**: https://github.com/ctyndg-ship-it/cfondg
- **Branch**: main

### Update & Deploy
```bash
# Pull latest
git pull origin main

# Rebuild Docker
docker-compose build
docker-compose up -d
```
