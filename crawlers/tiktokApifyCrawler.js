const axios = require('axios');
const db = require('../database/db');
const { logger } = require('../utils/logger');

const APIFY_TOKEN = process.env.APIFY_API_KEY;
const ACT_ID = process.env.APIFY_ACTOR_ID;

const HEALTH_HASHTAGS = [
  'health', 'fitness', 'workout', 'diet', 'nutrition', 'weightloss',
  'muscle', 'gym', 'exercise', 'healthytips', 'mentalhealth', 'sleep',
  'vitamins', 'supplements', 'guthealth', 'healthyfood', 'wellness'
];

async function runApifyScraper(hashtags, resultsPerPage = 30) {
  const input = {
    hashtags: hashtags,
    resultsPerPage: resultsPerPage,
    shouldDownloadCovers: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadSubtitles: false,
    shouldDownloadVideos: false
  };

  const response = await axios.post(
    `https://api.apify.com/v2/acts/${ACT_ID}/runs?token=${APIFY_TOKEN}`,
    input,
    { headers: { 'Content-Type': 'application/json' } }
  );

  const runId = response.data.data.id;
  logger.info(`   🔄 Apify run started: ${runId}`);

  let status = 'READY';
  let attempts = 0;
  const maxAttempts = 60;

  while (status === 'READY' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 2000));
    
    const statusResponse = await axios.get(
      `https://api.apify.com/v2/acts/${ACT_ID}/runs/${runId}?token=${APIFY_TOKEN}`
    );
    
    status = statusResponse.data.data.status;
    attempts++;
    
    if (status === 'SUCCEEDED') {
      return statusResponse.data.data.defaultDatasetId;
    } else if (status === 'FAILED') {
      throw new Error(statusResponse.data.data.statusMessage || 'Apify run failed');
    }
  }

  throw new Error('Apify run timed out');
}

async function getApifyData(datasetId) {
  const response = await axios.get(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
  );
  return response.data;
}

function transformToTikTokVideos(data) {
  return data.map(item => ({
    video_id: item.id,
    video_url: item.webVideoUrl,
    author: item.authorMeta?.name || 'unknown',
    views: item.playCount || 0,
    likes: item.diggCount || 0,
    comments: item.commentCount || 0,
    shares: item.shareCount || 0,
    create_time: item.createTime,
    description: item.text || '',
    hashtags: item.hashtags?.map(h => h.name).join(',') || '',
    likes_per_view: item.playCount ? (item.diggCount / item.playCount) : 0
  }));
}

function filterViralVideos(videos) {
  return videos.filter(v => {
    if (!v.video_id) return false;
    if (v.views < 50000) return false;
    return true;
  });
}

async function crawlTikTokApify() {
  logger.info('🚀 Starting TikTok crawler (Apify)...');

  try {
    const allVideos = [];

    for (let i = 0; i < HEALTH_HASHTAGS.length; i += 3) {
      const batch = HEALTH_HASHTAGS.slice(i, i + 3);
      logger.info(`   📊 Scraping batch: ${batch.join(', ')}`);

      try {
        const datasetId = await runApifyScraper(batch, 20);
        const data = await getApifyData(datasetId);
        
        if (data && data.length > 0) {
          const transformed = transformToTikTokVideos(data);
          allVideos.push(...transformed);
          logger.info(`   ✅ Got ${data.length} videos from hashtags: ${batch.join(', ')}`);
        }
      } catch (err) {
        logger.info(`   ⚠️ Batch failed: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    logger.info(`   📋 Total videos collected: ${allVideos.length}`);

    const uniqueVideos = allVideos.reduce((acc, v) => {
      const exists = acc.find(x => x.video_id === v.video_id);
      if (!exists) acc.push(v);
      return acc;
    }, []);

    logger.info(`   📋 Unique videos: ${uniqueVideos.length}`);

    const viralVideos = filterViralVideos(uniqueVideos);
    logger.info(`   🔥 Viral videos (views > 50k): ${viralVideos.length}`);

    if (viralVideos.length > 0) {
      const saved = db.saveTikTokVideos(viralVideos);
      logger.info(`   💾 Saved ${saved} viral videos to database`);
    }

    logger.info('✅ TikTok crawl complete!');
    return viralVideos;

  } catch (err) {
    logger.info(`❌ TikTok crawler error: ${err.message}`);
    throw err;
  }
}

module.exports = { crawlTikTokApify };

if (require.main === module) {
  (async () => {
    await db.initDB();
    await crawlTikTokApify();
    process.exit(0);
  })();
}
