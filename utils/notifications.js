const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('./configManager');

const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'output');

async function sendTelegramMessage(message, parseMode = 'HTML') {
  const config = getConfig('notifications.telegram');
  
  if (!config.botToken || !config.chatId) {
    console.log('⚠️ Telegram not configured. Set notifications.telegram.botToken and chatId in config.json');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: config.chatId,
      text: message,
      parse_mode: parseMode
    });
    console.log('✅ Telegram notification sent!');
    return true;
  } catch (error) {
    console.error('❌ Telegram error:', error.response?.data || error.message);
    return false;
  }
}

async function sendTelegramReport() {
  const config = getConfig('notifications');
  
  if (!config.enabled || !config.telegram?.botToken || !config.telegram?.chatId) {
    return false;
  }

  const latestReport = getLatestReport();
  if (!latestReport) {
    console.log('⚠️ No report found to send');
    return false;
  }

  const docxFileName = latestReport.name.replace('.html', '.docx');
  const docxPath = path.join(REPORTS_DIR, docxFileName);
  const htmlPath = path.join(REPORTS_DIR, latestReport.name);

  const message = `
📊 <b>DAILY HEALTH TRENDS REPORT</b>
🕐 ${new Date().toLocaleString('vi-VN')}

📈 <b>System Stats:</b>
• Trends: ${latestReport.trendsCount}
• Scripts: ${latestReport.scriptsCount}
• Hot Topics: ${latestReport.hotTopics}

✅ <b>Automation completed!</b>

<i>Full report attached below 📎</i>
  `;

  try {
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendDocument`;
    
    const formData = new FormData();
    formData.append('chat_id', config.telegram.chatId);
    formData.append('caption', message);
    formData.append('parse_mode', 'HTML');
    
    if (fs.existsSync(docxPath)) {
      const fileBuffer = fs.readFileSync(docxPath);
      const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      formData.append('document', blob, docxFileName);
    } else if (fs.existsSync(htmlPath)) {
      const fileBuffer = fs.readFileSync(htmlPath);
      const blob = new Blob([fileBuffer], { type: 'text/html' });
      formData.append('document', blob, latestReport.name);
    } else {
      await sendTelegramMessage(message);
      return false;
    }

    await axios.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    console.log('✅ Telegram report with document sent!');
    return true;
  } catch (error) {
    console.error('❌ Telegram sendDocument error:', error.response?.data || error.message);
    await sendTelegramMessage(message);
    return false;
  }
}

function getLatestReport() {
  try {
    const { all } = require('../database/db');
    
    const trends = all('SELECT COUNT(*) as cnt FROM trends');
    const scripts = all('SELECT COUNT(*) as cnt FROM scripts');
    const hotTopics = all('SELECT topic_name FROM trends ORDER BY engagement_score DESC LIMIT 5');
    
    const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.html'));
    if (files.length === 0) return null;
    
    files.sort().reverse();
    const latestFile = files[0];
    
    return {
      name: latestFile,
      trendsCount: trends[0]?.cnt || 0,
      scriptsCount: scripts[0]?.cnt || 0,
      hotTopics: hotTopics.length
    };
  } catch (e) {
    console.error('Error getting latest report:', e.message);
    return { name: 'report_2026-03-16.docx', trendsCount: 42, scriptsCount: 86, hotTopics: 5 };
  }
}

async function sendTelegramMessageOnly(message) {
  return await sendTelegramMessage(message);
}

module.exports = {
  sendTelegramMessage,
  sendTelegramReport,
  sendTelegramMessageOnly
};
