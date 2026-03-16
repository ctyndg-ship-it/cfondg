const { initDB } = require('./database/db');
const { initPipelineDB } = require('./pipeline/videoPipeline');
const { loadConfig, getConfig } = require('./utils/configManager');
const { logger } = require('./utils/logger');
const { fullBackup, listBackups } = require('./utils/backup');

const { runAllCrawlers } = require('./crawlers/trendCrawler');
const { generateAllScripts, getTodayScripts, getPendingScripts, updateScriptStatus, getScriptsByStatus } = require('./scripts/scriptGenerator');
const { getTodayStats, generateDailyReport, exportReport, showReportInConsole } = require('./reports/dailyReport');
const { scheduleDailyAutomation, runFullAutomation } = require('./scheduler/dailyScheduler');
const { getAllJobs, getJobsByStatus, createJobsFromScripts, updateJobStatus, getPipelineStats } = require('./pipeline/videoPipeline');

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     HEALTH TREND AUTOMATION SYSTEM v2.0                  ║');
  console.log('║     Daily Trend Hunter & Script Generator                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  await initDB();
  initPipelineDB();
  loadConfig();

  switch (command) {
    case 'crawl':
      await runAllCrawlers();
      break;

    case 'generate':
      const useAI = args.includes('--no-ai') ? false : getConfig('script.useAI');
      await generateAllScripts(50, useAI);
      break;

    case 'report':
    case 'export':
      const { exportReportMarkdown } = require('./reports/dailyReport');
      exportReportMarkdown();
      break;

    case 'full':
    case 'all':
      await runFullAutomation();
      createJobsFromScripts();
      break;

    case 'schedule':
      scheduleDailyAutomation();
      break;

    case 'dashboard':
      const DashboardServer = require('./dashboard/server');
      scheduleDailyAutomation();
      break;

    case 'backup':
      const result = await fullBackup();
      console.log('\n✅ Backup completed:', result);
      break;

    case 'view-backups':
      const backups = listBackups();
      console.log('\n📁 Available Backups:\n');
      backups.forEach(b => {
        console.log(`   ${b.name} (${Math.round(b.size/1024)}KB)`);
      });
      break;

    case 'pipeline-create':
      createJobsFromScripts();
      break;

    case 'pipeline':
      const stats = getJobsByStatus();
      console.log('\n📹 PIPELINE STATUS\n');
      Object.entries(stats).forEach(([status, count]) => {
        const icons = {
          'script_ready': '📝',
          'audio_generating': '🎤',
          'audio_ready': '✅',
          'video_generating': '🎬',
          'video_ready': '🎥',
          'rendering': '⚙️',
          'posted': '🚀',
          'failed': '❌'
        };
        console.log(`   ${icons[status] || '•'} ${status}: ${count}`);
      });
      break;

    case 'view-report':
      showReportInConsole();
      break;

    case 'export':
      exportReport();
      break;

    case 'view-scripts':
      const scripts = getTodayScripts();
      console.log('\n📜 TODAY\'S SCRIPTS:\n');
      scripts.forEach((s, i) => {
        console.log(`\n--- Script ${i + 1}: ${s.topic_name} ---\n`);
        console.log(s.full_script.substring(0, 400) + '...\n');
      });
      break;

    case 'config':
      if (args[1]) {
        const key = args[1];
        const value = args[2];
        if (value !== undefined) {
          require('./utils/configManager').setConfig(key, value);
          console.log(`✅ Set ${key} = ${value}`);
        } else {
          console.log(`${key} = ${getConfig(key)}`);
        }
      } else {
        console.log('\n📋 Current Config:\n');
        console.log(JSON.stringify(getConfig(), null, 2));
      }
      break;

    default:
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                    COMMAND LIST                             ║
╚════════════════════════════════════════════════════════════╝

📊 DATA:
  crawl         - Crawl all sources for trending topics
  generate      - Generate scripts from today's trends (--no-ai for template only)
  report        - Generate daily report

🤖 AUTOMATION:
  full          - Run full automation (crawl + generate + create jobs)
  schedule      - Schedule daily automation (runs at 6 AM)

📹 VIDEO PIPELINE:
  pipeline      - Show pipeline status
  pipeline-create - Create video jobs from today's scripts

📁 FILES:
  export        - Export report to file
  view-report   - View report in console
  view-scripts  - View today's generated scripts

💾 SYSTEM:
  backup        - Create full backup
  view-backups  - List available backups
  config [key] [value] - Get/set config

🎨 DASHBOARD:
  dashboard     - Start web dashboard

Example:
  node index.js full        - Run everything now
  node index.js pipeline   - Check pipeline status
  node index.js config system.logLevel debug
      `);
  }
}

main().catch(e => {
  logger.error('Main error:', e);
  console.error('Error:', e.message);
});
