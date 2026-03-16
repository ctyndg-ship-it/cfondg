const schedule = require('node-schedule');
const { initDB, run } = require('../database/db');
const { runAllCrawlers } = require('../crawlers/trendCrawler');
const { generateAllScripts } = require('../scripts/scriptGenerator');
const { generateDailyReport, exportReportDocx } = require('../reports/dailyReport');
const { sendTelegramReport } = require('../utils/notifications');

const SCHEDULE_TIMES = ['0 6 * * *', '0 12 * * *', '0 18 * * *'];

async function runFullAutomation() {
  console.log('\n🚀 === FULL AUTOMATION STARTED ===\n');

  try {
    await initDB();
    const now = new Date().toISOString();
    run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('last_run', ?)`, [now]);
    run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('last_crawl', ?)`, [now]);
    
    await runAllCrawlers();
    await generateAllScripts(50, false);
    generateDailyReport();
    exportReportDocx();
    
    await sendTelegramReport();

    console.log('\n✅ === FULL AUTOMATION COMPLETED ===\n');
    return { success: true };
  } catch (error) {
    console.error('❌ Automation error:', error);
    return { success: false, error: error.message };
  }
}

function scheduleDailyAutomation() {
  console.log(`\n📅 Scheduling daily automation at: ${SCHEDULE_TIMES.join(', ')}\n`);

  const jobs = [];
  for (const time of SCHEDULE_TIMES) {
    const job = schedule.scheduleJob(time, async () => {
      console.log('\n⏰ Scheduled automation triggered!\n');
      await runFullAutomation();
    });
    
    if (job) {
      jobs.push(job);
      console.log(`   ✅ Scheduled: ${time}`);
    } else {
      console.error(`   ❌ Failed: ${time}`);
    }
  }

  console.log(`\n✅ ${jobs.length}/3 daily automations scheduled!`);
  return jobs;
}

async function runManual() {
  console.log('\n🎯 Running manual automation...\n');
  return await runFullAutomation();
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'schedule') {
    scheduleDailyAutomation();
  } else if (args[0] === 'now') {
    runManual();
  } else {
    console.log(`
Usage:
  node dailyScheduler.js now      - Run automation now
  node dailyScheduler.js schedule - Schedule daily automation (6 AM)

Example:
  node dailyScheduler.js now
    `);
  }
}

module.exports = {
  runFullAutomation,
  scheduleDailyAutomation,
  runManual
};
