const { sendTelegramMessage } = require('./utils/notifications');

const msg = `
📊 <b>DAILY HEALTH TRENDS REPORT</b>
🕐 ${new Date().toLocaleString('vi-VN')}

📈 <b>Stats:</b>
• Trends: 42
• Scripts: 86
• Reports: 1

✅ <b>Automation completed!</b>

🔗 View at: http://localhost:3000

<i>Test message from HealthHunter</i>
`;

sendTelegramMessage(msg).then(() => {
  console.log('Done');
  process.exit(0);
});
