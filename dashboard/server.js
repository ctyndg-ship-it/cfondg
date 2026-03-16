const express = require('express');
const { initDB, run, all, get, saveDB } = require('../database/db');
const { runAllCrawlers } = require('../crawlers/trendCrawler');
const { generateAllScripts } = require('../scripts/scriptGenerator');
const { getTodayStats, generateDailyReport, exportReportDocx } = require('../reports/dailyReport');
const { getTrendAnalysis, saveTrendsToDatabase, processRedditPosts } = require('../crawlers/trendAnalyzer');
const { sendTelegramReport } = require('../utils/notifications');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'output');

const REAL_SOURCES = ['news', 'reddit', 'google_trends'];

function getReportFiles() {
  try {
    if (!fs.existsSync(REPORTS_DIR)) return [];
    return fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.html') || f.endsWith('.md') || f.endsWith('.docx'))
      .map(f => {
        const filePath = path.join(REPORTS_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          path: `/api/reports/${f}`,
          size: stats.size,
          type: f.endsWith('.html') ? 'html' : f.endsWith('.docx') ? 'docx' : 'md',
          created: stats.birthtime
        };
      })
      .sort((a, b) => b.created - a.created);
  } catch (e) {
    return [];
  }
}

app.get('/api/stats', (req, res) => {
  const totalTrendsResult = all('SELECT COUNT(*) as cnt FROM trends');
  const totalTrends = totalTrendsResult[0]?.cnt || 0;
  
  const placeholders = REAL_SOURCES.map(() => '?').join(',');
  const realTrendsResult = all(`SELECT COUNT(*) as cnt FROM trends WHERE source IN (${placeholders})`, REAL_SOURCES);
  const realTrends = realTrendsResult[0]?.cnt || 0;
  
  const scriptsResult = all('SELECT COUNT(*) as cnt FROM scripts');
  const scripts = scriptsResult[0]?.cnt || 0;
  
  const reports = getReportFiles();
  
  const topTopics = all(`
    SELECT topic_name, source, engagement_score, source_url
    FROM trends 
    WHERE source IN (${placeholders})
    ORDER BY engagement_score DESC 
    LIMIT 5
  `, REAL_SOURCES);
  
  const lastCrawlResult = all(`SELECT MAX(discovered_at) as last FROM trends`);
  const lastCrawl = lastCrawlResult[0]?.last || null;
  
  const lastRunResult = get(`SELECT value FROM settings WHERE key = 'last_run'`);
  const lastRun = lastRunResult?.value || null;

  res.json({
    totalTrends,
    realTrends,
    totalScripts: scripts,
    totalReports: reports.length,
    hotTopics: topTopics,
    lastCrawl,
    lastRun
  });
});

app.get('/api/trends', (req, res) => {
  const source = req.query.source;
  const limit = parseInt(req.query.limit) || 50;
  
  let sql, params;
  
  if (source && source !== 'all') {
    sql = 'SELECT * FROM trends WHERE source = ? ORDER BY (engagement_score + growth_rate) DESC LIMIT ?';
    params = [source, limit];
  } else {
    const placeholders = REAL_SOURCES.map(() => '?').join(',');
    sql = `SELECT * FROM trends WHERE source IN (${placeholders}) ORDER BY (engagement_score + growth_rate) DESC LIMIT ?`;
    params = [...REAL_SOURCES, limit];
  }
  
  const trends = all(sql, params);
  res.json(trends);
});

app.get('/api/scripts', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const scripts = all(`
    SELECT * FROM scripts
    ORDER BY id DESC
    LIMIT ?
  `, [limit]);
  res.json(scripts);
});

app.delete('/api/scripts/:id', (req, res) => {
  try {
    run(`DELETE FROM scripts WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/scripts', (req, res) => {
  try {
    const { topic_name, full_script, hashtags } = req.body;
    run(`
      INSERT INTO scripts (topic_name, full_script, hashtags, status, duration)
      VALUES (?, ?, ?, 'draft', 30)
    `, [topic_name, full_script, hashtags || '']);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/sources', (req, res) => {
  const sources = all(`
    SELECT source, COUNT(*) as cnt 
    FROM trends 
    GROUP BY source 
    ORDER BY cnt DESC
  `);
  res.json(sources);
});

app.get('/api/reports', (req, res) => {
  res.json(getReportFiles());
});

app.get('/api/reports/:filename', (req, res) => {
  const filePath = path.join(REPORTS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/crawl', async (req, res) => {
  try {
    await runAllCrawlers();
    res.json({ success: true, message: 'Crawl completed!' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/generate-report', async (req, res) => {
  try {
    const { exportReport, exportReportDocx } = require('../reports/dailyReport');
    await initDB();
    exportReport();
    await exportReportDocx();
    res.json({ success: true, message: 'Report generated!' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/analyze-trends', async (req, res) => {
  try {
    const analysis = await getTrendAnalysis();
    res.json(analysis);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-save', async (req, res) => {
  try {
    const analysis = await getTrendAnalysis();
    const saved = saveTrendsToDatabase(analysis.trends);
    res.json({ success: true, saved: saved.length, trends: analysis.trends.slice(0, 10) });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/set-telegram', async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    if (!botToken || !chatId) {
      return res.json({ success: false, error: 'Missing botToken or chatId' });
    }
    const testUrl = `https://api.telegram.org/bot${botToken}/getMe`;
    await axios.get(testUrl);
    const configPath = path.join(__dirname, '..', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.notifications.enabled = true;
    config.notifications.telegram.botToken = botToken;
    config.notifications.telegram.chatId = chatId;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    res.json({ success: true, message: 'Telegram configured!' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/telegram-help', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Telegram Setup</title>
  <style>
    body { font-family: Arial; padding: 40px; background: #0a0b14; color: #fff; }
    .box { background: #1a1c2e; padding: 24px; border-radius: 12px; max-width: 500px; margin: 0 auto; }
    input { width: 100%; padding: 12px; margin: 8px 0; border-radius: 8px; border: 1px solid #333; background: #12131d; color: #fff; }
    button { width: 100%; padding: 14px; background: #00d4aa; border: none; border-radius: 8px; color: #0a0b14; font-weight: bold; cursor: pointer; margin-top: 16px; }
    button:hover { background: #00ffcc; }
    .step { margin: 16px 0; padding: 12px; background: #22243a; border-radius: 8px; }
    h2 { color: #00d4aa; }
  </style>
</head>
<body>
  <div class="box">
    <h2>📱 Telegram Setup</h2>
    <div class="step">
      <b>1.</b> Tạo bot bằng cách nhắn @BotFather trên Telegram với lệnh /newbot
    </div>
    <div class="step">
      <b>2.</b> Copy Bot Token từ BotFather và dán vào ô dưới
    </div>
    <div class="step">
      <b>3.</b> Nhắn tin bất kỳ cho bot của bạn
    </div>
    <div class="step">
      <b>4.</b> Dán link này vào trình duyệt (thay TOKEN bằng bot token của bạn):<br>
      <code>https://api.telegram.org/botTOKEN/getUpdates</code><br>
      Tìm "chat":{"id": trong kết quả - đó là Chat ID
    </div>
    <input type="text" id="token" placeholder="Bot Token (ví dụ: 123456:ABC...)">
    <input type="text" id="chat" placeholder="Chat ID (ví dụ: 123456789)">
    <button onclick="saveConfig()">💾 Lưu & Test</button>
  </div>
  <script>
    async function saveConfig() {
      const token = document.getElementById('token').value;
      const chat = document.getElementById('chat').value;
      const res = await fetch('/api/set-telegram', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({botToken: token, chatId: chat})
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Telegram đã được cấu hình!');
        location.href = '/';
      } else {
        alert('❌ Lỗi: ' + data.error);
      }
    }
  </script>
</body>
</html>
  `);
});

app.post('/api/run-full', async (req, res) => {
  try {
    const now = new Date().toISOString();
    run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('last_run', ?)`, [now]);
    run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('last_crawl', ?)`, [now]);
    
    await runAllCrawlers();
    await generateAllScripts(50, true);
    generateDailyReport();
    await exportReportDocx();
    
    await sendTelegramReport();
    
    const trendsResult = all('SELECT COUNT(*) as cnt FROM trends');
    const placeholders = REAL_SOURCES.map(() => '?').join(',');
    const realResult = all(`SELECT COUNT(*) as cnt FROM trends WHERE source IN (${placeholders})`, REAL_SOURCES);
    const scriptsResult = all('SELECT COUNT(*) as cnt FROM scripts');
    
    const stats = {
      totalTrends: trendsResult[0]?.cnt || 0,
      realTrends: realResult[0]?.cnt || 0,
      totalScripts: scriptsResult[0]?.cnt || 0,
      totalReports: getReportFiles().length,
      lastRun: now
    };
    res.json({ success: true, stats });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  await initDB();
  const { scheduleDailyAutomation } = require('../scheduler/dailyScheduler');
  scheduleDailyAutomation();
  app.listen(PORT, () => {
    console.log(`🚀 Dashboard running at: http://localhost:${PORT}`);
  });
}

start();
