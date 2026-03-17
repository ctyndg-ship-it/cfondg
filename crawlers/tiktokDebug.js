const { chromium } = require('playwright');
const db = require('../database/db');
const { logger } = require('../utils/logger');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function debugTikTok() {
  logger.info('🔍 Debugging TikTok page structure...');
  
  let browser = null;
  
  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    await page.goto('https://www.tiktok.com', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(5000);
    
    logger.info('📄 Page title: ' + await page.title());
    
    const links = await page.evaluate(() => {
      const allLinks = document.querySelectorAll('a[href*="/video/"]');
      return Array.from(allLinks).slice(0, 10).map(l => ({
        href: l.href,
        text: l.textContent?.substring(0, 50),
        parent: l.parentElement?.className
      }));
    });
    
    logger.info('📊 Found video links: ' + links.length);
    links.forEach(l => logger.info(`   - ${l.href}`));
    
    const bodyContent = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));
    logger.info('📄 Body preview: ' + bodyContent);
    
    await page.screenshot({ path: 'tiktok-debug.png' });
    logger.info('📸 Screenshot saved to tiktok-debug.png');
    
  } catch (err) {
    logger.info(`❌ Error: ${err.message}`);
  } finally {
    // await browser.close();
  }
}

if (require.main === module) {
  debugTikTok().then(() => setTimeout(() => process.exit(0), 10000));
}

module.exports = { debugTikTok };
