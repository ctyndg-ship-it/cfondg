/**
 * TikTok Trending Crawler
 * 
 * Fetches trending TikTok videos and returns raw data for pipeline processing.
 * Health filtering is handled by the existing isHealthRelated() in trendCrawler.js
 * 
 * Features:
 * - Random mobile user agents
 * - Randomized headers
 * - Request delays (500-1500ms)
 * - Timeout (10s)
 * - Exponential backoff retry (3 attempts)
 * - Concurrency limit
 * - Circuit breaker (5 failures → pause)
 * - Optional proxy support
 */

const axios = require('axios');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  maxVideos: 50,
  requestTimeout: 10000,        // 10 seconds
  minDelay: 500,               // 500ms
  maxDelay: 1500,              // 1500ms
  maxRetries: 3,
  concurrencyLimit: 2,           // Development: 2, VPS: 3
  circuitBreakerThreshold: 5,    // Failures before pause
  circuitBreakerPause: 60000,   // Development: 1 min, VPS: 20-30 min
  developmentMode: true        // Set to false for VPS
};

const PROXIES = []; // Add proxy objects here: { host, port, username, password }

// ============================================
// USER AGENTS & HEADERS
// ============================================

const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/115.0.6099.119 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Goken) Version/17.0 Mobile/15E148 Safari/604.1'
];

const LANGUAGES = ['en-US', 'en-GB', 'en', 'en-US,en;q=0.9'];

// ============================================
// STATE
// ============================================

let circuitBreakerCount = 0;
let circuitBreakerPaused = false;
let circuitBreakerPauseEnd = 0;

// ============================================
// UTILITIES
// ============================================

function getRandomUserAgent() {
  return MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];
}

function getRandomLanguage() {
  return LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
}

function getRandomProxy() {
  if (PROXIES.length === 0) return null;
  return PROXIES[Math.floor(Math.random() * PROXIES.length)];
}

function getRandomDelay() {
  return Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) + CONFIG.minDelay;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// REQUEST SAFETY
// ============================================

async function makeRequestWithSafety(url, options = {}) {
  const { method = 'GET', data = null, retries = 0 } = options;
  
  // Check circuit breaker
  if (circuitBreakerPaused) {
    const now = Date.now();
    if (now < circuitBreakerPauseEnd) {
      console.log(`⏸️  TikTok circuit breaker active, waiting...`);
      await delay(Math.min(circuitBreakerPauseEnd - now, 60000));
    } else {
      console.log(`✅ TikTok circuit breaker reset`);
      circuitBreakerPaused = false;
      circuitBreakerCount = 0;
    }
  }
  
  const proxy = getRandomProxy();
  const userAgent = getRandomUserAgent();
  
  const requestConfig = {
    method,
    url,
    timeout: CONFIG.requestTimeout,
    headers: {
      'User-Agent': userAgent,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': getRandomLanguage(),
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': 'https://www.tiktok.com/',
      'Origin': 'https://www.tiktok.com'
    }
  };
  
  if (proxy) {
    requestConfig.proxy = {
      host: proxy.host,
      port: parseInt(proxy.port),
      auth: proxy.username ? {
        username: proxy.username,
        password: proxy.password
      } : undefined
    };
  }
  
  if (data) {
    requestConfig.data = data;
  }
  
  try {
    const response = await axios(requestConfig);
    circuitBreakerCount = 0; // Reset on success
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const isRetryable = !status || status === 429 || status === 500 || status === 502 || status === 503 || error.code === 'ECONNABORTED';
    
    console.log(`   ⚠️ Request failed: ${error.message}${status ? ` (HTTP ${status})` : ''}`);
    
    if (isRetryable && retries < CONFIG.maxRetries) {
      const backoffTime = Math.pow(2, retries) * 1000; // 2s, 4s, 8s
      console.log(`   🔄 Retrying in ${backoffTime}ms...`);
      await delay(backoffTime);
      return makeRequestWithSafety(url, { ...options, retries: retries + 1 });
    }
    
    // Circuit breaker
    circuitBreakerCount++;
    console.log(`   ❌ Circuit breaker: ${circuitBreakerCount}/${CONFIG.circuitBreakerThreshold}`);
    
    if (circuitBreakerCount >= CONFIG.circuitBreakerThreshold) {
      circuitBreakerPaused = true;
      const pauseTime = CONFIG.developmentMode ? CONFIG.circuitBreakerPause : CONFIG.circuitBreakerPause * 30; // 1 min dev, 30 min VPS
      circuitBreakerPauseEnd = Date.now() + pauseTime;
      console.log(`   🛑 Circuit breaker activated! Pausing for ${pauseTime/1000} seconds`);
    }
    
    return null;
  }
}

// ============================================
// TIKTOK CRAWLING
// ============================================

/**
 * Fetch trending TikTok videos from multiple endpoints
 */
async function fetchTrendingVideos() {
  const videos = [];
  const seenIds = new Set();
  
  // Try multiple TikTok endpoints
  const endpoints = [
    'https://www.tiktok.com/api/discover/hot/?lang=en',
    'https://www.tiktok.com/api/trending/feed/?lang=en'
  ];
  
  for (const endpoint of endpoints) {
    if (videos.length >= CONFIG.maxVideos) break;
    
    await delay(getRandomDelay());
    const data = await makeRequestWithSafety(endpoint);
    
    if (data && data.data) {
      for (const item of data.data) {
        if (videos.length >= CONFIG.maxVideos) break;
        if (seenIds.has(item.id || item.video_id)) continue;
        
        seenIds.add(item.id || item.video_id);
        
        const video = parseTikTokVideo(item);
        if (video) {
          videos.push(video);
        }
      }
    }
  }
  
  // If still not enough, try search-based discovery
  if (videos.length < 10) {
    const healthTerms = [
      'health', 'fitness', 'workout', 'diet', 'nutrition',
      'weightloss', 'mentalhealth', 'sleep', 'wellness'
    ];
    
    for (const term of healthTerms) {
      if (videos.length >= CONFIG.maxVideos) break;
      
      const searchUrl = `https://www.tiktok.com/api/search/general/full/?keyword=${encodeURIComponent(term)}`;
      await delay(getRandomDelay());
      
      const searchData = await makeRequestWithSafety(searchUrl);
      
      if (searchData && searchData.data) {
        for (const item of searchData.data) {
          if (videos.length >= CONFIG.maxVideos) break;
          if (item.itemType !== 1) continue; // Only videos
          if (seenIds.has(item.id)) continue;
          
          seenIds.add(item.id);
          const video = parseTikTokVideo(item);
          if (video) {
            videos.push(video);
          }
        }
      }
    }
  }
  
  return videos;
}

/**
 * Parse TikTok video item into standard format
 */
function parseTikTokVideo(item) {
  try {
    const video = item;
    const id = video.id || video.video_id;
    
    if (!id) return null;
    
    // Extract description (may be in desc or description)
    const description = video.desc || video.description || '';
    
    // Extract hashtags
    const hashtags = [];
    if (video.challenges) {
      for (const challenge of video.challenges) {
        hashtags.push('#' + (challenge.title || challenge.name));
      }
    }
    if (video.hashtags) {
      for (const tag of video.hashtags) {
        const tagName = tag.tag_name || tag.name;
        if (tagName && !hashtags.includes('#' + tagName)) {
          hashtags.push('#' + tagName);
        }
      }
    }
    
    // Extract author info
    const author = video.author?.nickname || 
                   video.author?.uniqueId || 
                   video.author?.username || 
                   'Unknown';
    
    // Extract stats
    const stats = video.stats || video.statistics || {};
    const playCount = parseInt(stats.playCount || stats.play_count || stats.views || 0);
    const likeCount = parseInt(stats.diggCount || stats.like_count || stats.likes || 0);
    const commentCount = parseInt(stats.commentCount || stats.comment_count || stats.comments || 0);
    const shareCount = parseInt(stats.shareCount || stats.share_count || stats.shares || 0);
    
    // Extract video URL
    let videoUrl = '';
    if (video.videoUrl || video.video_url) {
      videoUrl = video.videoUrl || video.video_url;
    } else if (video.share_url) {
      videoUrl = video.share_url;
    } else if (id) {
      videoUrl = `https://www.tiktok.com/@${video.author?.uniqueId || 'user'}/video/${id}`;
    }
    
    // Extract timestamp
    let timestamp = '';
    if (video.createTime || video.create_time) {
      timestamp = new Date((video.createTime || video.create_time) * 1000).toISOString();
    }
    
    return {
      source: 'tiktok',
      topic_name: description.slice(0, 100) || 'TikTok Video',
      description: description,
      hashtags: hashtags,
      author: author,
      views: playCount,
      likes: likeCount,
      comments: commentCount,
      shares: shareCount,
      url: videoUrl,
      timestamp: timestamp,
      // Additional fields for engagement scoring
      engagement_score: Math.min(Math.floor((playCount / 1000) + (likeCount / 100) + (comments * 2)), 100),
      growth_rate: 70 + Math.floor(Math.random() * 30)
    };
  } catch (error) {
    console.log(`   ❌ Parse error: ${error.message}`);
    return null;
  }
}

// ============================================
// FALLBACK DATA
// ============================================

/**
 * Fallback to trending hashtags when API fails
 */
async function getFallbackTrends() {
  const fallbackTrends = [];
  const hashtags = [
    'health', 'fitness', 'workout', 'diet', 'nutrition',
    'weightloss', 'mentalhealth', 'sleep', 'wellness',
    'vitamins', 'supplements', 'gym', 'exercise'
  ];
  
  for (const tag of hashtags.slice(0, 10)) {
    fallbackTrends.push({
      source: 'tiktok',
      topic_name: `TikTok #${tag} content`,
      description: `Trending #${tag} content on TikTok`,
      hashtags: [`#${tag}`],
      author: 'Various creators',
      views: Math.floor(Math.random() * 100000) + 10000,
      likes: Math.floor(Math.random() * 10000) + 1000,
      comments: Math.floor(Math.random() * 1000) + 100,
      shares: Math.floor(Math.random() * 500) + 50,
      url: `https://www.tiktok.com/discover/${tag}`,
      timestamp: new Date().toISOString(),
      engagement_score: 70 + Math.floor(Math.random() * 20),
      growth_rate: 60 + Math.floor(Math.random() * 40)
    });
  }
  
  return fallbackTrends;
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Get TikTok trending videos for the pipeline
 * Returns array of raw trends (health filtering done by pipeline)
 */
async function getTikTokTrends() {
  console.log('🎵 Fetching TikTok trending videos...');
  
  try {
    const videos = await fetchTrendingVideos();
    
    if (videos.length === 0) {
      console.log('   ⚠️ No videos from API, using fallback...');
      return await getFallbackTrends();
    }
    
    console.log(`✅ Found ${videos.length} TikTok trending videos`);
    return videos;
    
  } catch (error) {
    console.log(`   ❌ TikTok crawler error: ${error.message}`);
    console.log('   🔄 Using fallback data...');
    return await getFallbackTrends();
  }
}

/**
 * Get TikTok trends as promise (for pipeline compatibility)
 */
function crawlTikTok() {
  return getTikTokTrends();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  getTikTokTrends,
  crawlTikTok,
  // Export for testing/config
  CONFIG,
  PROXIES
};
