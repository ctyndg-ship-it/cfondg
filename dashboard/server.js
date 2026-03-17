const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const { initDB, run, all, get, saveDB } = require('../database/db');
const { runAllCrawlers } = require('../crawlers/trendCrawler');
const { generateAllScripts } = require('../scripts/scriptGenerator');
const { getTodayStats, generateDailyReport } = require('../reports/dailyReport');
const { getTrendAnalysis, saveTrendsToDatabase, processRedditPosts } = require('../crawlers/trendAnalyzer');
const { sendTelegramReport } = require('../utils/notifications');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'output');

const REAL_SOURCES = ['news', 'reddit', 'google_trends', 'youtube'];

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
    LIMIT 10
  `, REAL_SOURCES);
  
  const lastCrawlResult = all(`SELECT MAX(discovered_at) as last FROM trends`);
  const lastCrawl = lastCrawlResult[0]?.last || null;
  
  const lastRunResult = get(`SELECT value FROM settings WHERE key = 'last_run'`);
  const lastRun = lastRunResult?.value || null;

  const tiktokTotal = all('SELECT COUNT(*) as cnt FROM tiktok_videos');
  const tiktokViral = all('SELECT COUNT(*) as cnt FROM tiktok_videos WHERE views >= 50000');
  const youtubeTotal = all("SELECT COUNT(*) as cnt FROM trends WHERE source = 'youtube'");

  res.json({
    totalTrends,
    realTrends,
    totalScripts: scripts,
    totalReports: reports.length,
    hotTopics: topTopics,
    lastCrawl,
    lastRun,
    youtube: youtubeTotal[0]?.cnt || 0,
    tiktok: tiktokTotal[0]?.cnt || 0,
    tiktokViral: tiktokViral[0]?.cnt || 0
  });
});

app.get('/api/keywords', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const placeholders = REAL_SOURCES.map(() => '?').join(',');
  
  const trends = all(`
    SELECT id, topic_name, source, engagement_score, growth_rate, description, metadata
    FROM trends 
    WHERE source IN (${placeholders}) 
    ORDER BY (engagement_score + growth_rate) DESC 
    LIMIT ?
  `, [...REAL_SOURCES, limit]);
  
  res.json(trends);
});

app.get('/api/trends', (req, res) => {
  const source = req.query.source;
  const limit = parseInt(req.query.limit) || 50;
  const dateFilter = req.query.date || 'all';
  
  let dateClause = '';
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  
  if (dateFilter === 'today') {
    dateClause = `AND collected_date = '${today}'`;
  } else if (dateFilter === 'yesterday') {
    dateClause = `AND collected_date = '${yesterday}'`;
  } else if (dateFilter === 'week') {
    dateClause = `AND collected_date >= '${weekAgo}'`;
  }
  
  let sql, params;
  
  if (source && source !== 'all') {
    sql = `SELECT * FROM trends WHERE source = ? ${dateClause} ORDER BY (engagement_score + growth_rate) DESC LIMIT ?`;
    params = [source, limit];
  } else {
    const placeholders = REAL_SOURCES.map(() => '?').join(',');
    sql = `SELECT * FROM trends WHERE source IN (${placeholders}) ${dateClause} ORDER BY (engagement_score + growth_rate) DESC LIMIT ?`;
    params = [...REAL_SOURCES, limit];
  }
  
  const trends = all(sql, params);
  res.json(trends);
});

app.get('/api/scripts', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const dateFilter = req.query.date || 'all';
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  
  let dateClause = '';
  if (dateFilter === 'today') {
    dateClause = `AND date(generated_at) = '${today}'`;
  } else if (dateFilter === 'yesterday') {
    dateClause = `AND date(generated_at) = '${yesterday}'`;
  } else if (dateFilter === 'week') {
    dateClause = `AND date(generated_at) >= '${weekAgo}'`;
  }
  
  const scripts = all(`
    SELECT * FROM scripts
    WHERE 1=1 ${dateClause}
    ORDER BY id DESC
    LIMIT ?
  `, [limit]);
  res.json(scripts);
});

app.post('/api/cleanup', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  
  try {
    run(`DELETE FROM trends WHERE collected_date < ?`, [cutoffDate]);
    run(`DELETE FROM scripts WHERE date(generated_at) < ?`, [cutoffDate]);
    
    res.json({ success: true, message: `Deleted data older than ${days} days (before ${cutoffDate})` });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
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

app.get('/api/tiktok', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const videos = all(`
    SELECT * FROM tiktok_videos 
    ORDER BY views DESC 
    LIMIT ?
  `, [limit]);
  res.json(videos);
});

app.get('/api/tiktok-stats', (req, res) => {
  const total = all('SELECT COUNT(*) as cnt FROM tiktok_videos');
  const viral = all('SELECT COUNT(*) as cnt FROM tiktok_videos WHERE views >= 50000');
  const topViews = get('SELECT MAX(views) as max FROM tiktok_videos');
  res.json({
    total: total[0]?.cnt || 0,
    viral: viral[0]?.cnt || 0,
    topViews: topViews?.max || 0
  });
});

app.get('/api/youtube-stats', (req, res) => {
  const total = all("SELECT COUNT(*) as cnt FROM trends WHERE source = 'youtube'");
  const recent = all("SELECT COUNT(*) as cnt FROM trends WHERE source = 'youtube' AND discovered_at >= datetime('now', '-24 hours')");
  res.json({
    total: total[0]?.cnt || 0,
    last24h: recent[0]?.cnt || 0
  });
});

app.get('/api/reports/:filename', (req, res) => {
  const filePath = path.join(REPORTS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    if (req.params.filename.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
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

app.post('/api/crawl/reddit', async (req, res) => {
  try {
    const { crawlReddit } = require('../crawlers/trendCrawler');
    const { saveTrends } = require('../crawlers/trendCrawler');
    await initDB();
    
    console.log('🔄 Crawling Reddit only...');
    const reddit = await crawlReddit();
    saveTrends(reddit);
    
    res.json({ success: true, source: 'reddit', count: reddit.length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/crawl/news', async (req, res) => {
  try {
    const { crawlNews } = require('../crawlers/trendCrawler');
    const { saveTrends } = require('../crawlers/trendCrawler');
    await initDB();
    
    console.log('🔄 Crawling News only...');
    const news = await crawlNews();
    saveTrends(news);
    
    res.json({ success: true, source: 'news', count: news.length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/crawl/youtube', async (req, res) => {
  try {
    const { crawlYouTube } = require('../crawlers/trendCrawler');
    const { saveTrends } = require('../crawlers/trendCrawler');
    await initDB();
    
    console.log('🔄 Crawling YouTube only...');
    const youtube = await crawlYouTube();
    saveTrends(youtube);
    
    res.json({ success: true, source: 'youtube', count: youtube.length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/crawl/google', async (req, res) => {
  try {
    const { crawlGoogleTrends } = require('../crawlers/trendCrawler');
    const { saveTrends } = require('../crawlers/trendCrawler');
    await initDB();
    
    console.log('🔄 Crawling Google Trends only...');
    const googleTrends = await crawlGoogleTrends();
    saveTrends(googleTrends);
    
    res.json({ success: true, source: 'google_trends', count: googleTrends.length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/crawl-only', async (req, res) => {
  try {
    const { crawlReddit, crawlNews, crawlGoogleTrends, crawlYouTube } = require('../crawlers/trendCrawler');
    await initDB();
    
    console.log('🔄 Crawling data only...');
    
    const [reddit, news, googleTrends, youtube] = await Promise.all([
      crawlReddit(),
      crawlNews(),
      crawlGoogleTrends(),
      crawlYouTube()
    ]);
    
    const allTrends = [...reddit, ...news, ...googleTrends, ...youtube];
    const { saveTrends, deduplicateTrends } = require('../crawlers/trendCrawler');
    saveTrends(allTrends);
    
    const countResult = all('SELECT COUNT(*) as cnt FROM trends WHERE collected_date = date("now")');
    
    res.json({ 
      success: true, 
      message: 'Crawl completed!',
      stats: {
        reddit: reddit.length,
        news: news.length,
        google: googleTrends.length,
        youtube: youtube.length,
        total: allTrends.length,
        unique: countResult[0]?.cnt || 0
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/scripts-only', async (req, res) => {
  try {
    await initDB();
    const { generateAllScripts } = require('../scripts/scriptGenerator');
    
    console.log('🔄 Generating scripts only...');
    
    const scripts = await generateAllScripts(20, true);
    
    res.json({ 
      success: true, 
      message: `Generated ${scripts.length} scripts!`,
      count: scripts.length
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/report-only', async (req, res) => {
  try {
    const { exportReport } = require('../reports/dailyReport');
    await initDB();
    
    console.log('🔄 Generating report only...');
    
    exportReport();
    
    res.json({ success: true, message: 'Report generated!' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/generate-report', async (req, res) => {
  try {
    const { exportReport } = require('../reports/dailyReport');
    await initDB();
    exportReport();
    res.json({ success: true, message: 'Report generated!' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/daily-summary', (req, res) => {
  try {
    const { getDailySummary } = require('../reports/dailyReport');
    const summary = getDailySummary();
    res.json(summary);
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
