const { chromium } = require('playwright');
const db = require('../database/db');
const { logger } = require('../utils/logger');

const HEALTH_KEYWORDS = [
  'health tips', 'fitness', 'workout', 'diet', 'nutrition',
  'weight loss', 'muscle', 'gym', 'exercise', 'sleep'
];

async function crawlTikTokWithProxy() {
  logger.info('🎵 Crawling TikTok with Proxy...');
  
  let browser = null;
  
  try {
    // Use Apify proxy from environment variables
    const proxy = {
      server: process.env.APIFY_PROXY_SERVER || 'http://proxy.apify.com:8000',
      username: process.env.APIFY_PROXY_USERNAME,
      password: process.env.APIFY_PROXY_PASSWORD
    };
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    
    const page = await context.newPage();
    
    // Try to access TikTok search
    const trends = [];
    
    for (const keyword of HEALTH_KEYWORDS.slice(0, 3)) {
      try {
        await page.goto(`https://www.tiktok.com/search?q=${encodeURIComponent(keyword)}`, {
          waitUntil: 'networkidle',
          timeout: 15000
        });
        
        await page.waitForTimeout(3000);
        
        const videos = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('a[href*="/video/"]').forEach(link => {
            const href = link.href;
            if (href && href.includes('/video/') && !href.includes('/@')) {
              const match = href.match(/\/video\/(\d+)/);
              if (match) {
                items.push({
                  video_id: match[1],
                  url: href
                });
              }
            }
          });
          return items.slice(0, 10);
        });
        
        logger.info(`   🔍 "${keyword}": ${videos.length} videos`);
        trends.push(...videos);
        
      } catch (e) {
        logger.info(`   ⚠️ "${keyword}": ${e.message}`);
      }
    }
    
    logger.info(`   Total: ${trends.length} videos`);
    
    // Save unique videos
    const unique = [];
    const seen = new Set();
    for (const v of trends) {
      if (!seen.has(v.video_id)) {
        seen.add(v.video_id);
        unique.push({
          video_id: v.video_id,
          video_url: v.url,
          keyword: 'health'
        });
      }
    }
    
    if (unique.length > 0) {
      logger.info(`   💾 Saving ${unique.length} TikTok videos`);
      // db.saveTikTokVideos(unique);
    }
    
    return unique;
    
  } catch (err) {
    logger.info(`❌ Error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { crawlTikTokWithProxy };

if (require.main === module) {
  (async () => {
    await db.initDB();
    await crawlTikTokWithProxy();
    process.exit(0);
  })();
}
