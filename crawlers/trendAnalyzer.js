const { all, run, initDB } = require('../database/db');

const HEALTH_TOPICS = [
  'supplement', 'biohack', 'biohack', 'hormone', 'nootropic', 'creatine', 'caffeine',
  'sleep', 'circadian', 'melatonin', 'nutrition', 'macro', 'protein', 'amino',
  'longevity', 'anti-aging', 'telomere', 'senolytic', 'metformin', 'resveratrol',
  'mental', 'cognitive', 'brain', 'memory', 'focus', 'anxiety', 'depression', 'mood',
  'fitness', 'workout', 'recovery', 'muscle', 'strength', 'cardio', 'hypertrophy',
  'weight', 'fat', 'calorie', 'diet', 'keto', 'paleo', 'vegan', 'intermittent fasting',
  'diabetes', 'blood sugar', 'insulin', 'glucose', 'cholesterol', 'blood pressure',
  'heart', 'cardiovascular', 'cancer', 'immune', 'immunity', 'inflammation',
  'gut', 'digest', 'probiotic', 'microbiome', 'fiber',
  'vitamin', 'mineral', 'deficiency', 'd3', 'magnesium', 'zinc', 'omega'
];

const LOW_QUALITY_PATTERNS = [
  'meme', 'joke', 'lol', 'lmao', 'haha', 'funny', 'rofl',
  'diary', 'my story', 'rant', 'vent', 'just wanted',
  'unrelated', 'not health', 'delete this', 'btw',
  'update:', 'success story', 'before after', 'progress pic',
  'lol.', '😂', '🤣', '💀'
];

function isHealthRelated(title, selftext = '') {
  const text = (title + ' ' + selftext).toLowerCase();
  return HEALTH_TOPICS.some(topic => text.includes(topic));
}

function isLowQuality(title, selftext = '') {
  const text = (title + ' ' + selftext).toLowerCase();
  return LOW_QUALITY_PATTERNS.some(pattern => text.includes(pattern));
}

function extractKeywords(title, selftext = '') {
  const text = (title + ' ' + selftext).toLowerCase();
  const found = [];
  
  const keywordMap = {
    'supplement': 'supplements',
    'creatine': 'creatine',
    'caffeine': 'caffeine',
    'melatonin': 'sleep',
    'circadian': 'sleep',
    'nootropic': 'nootropics',
    'biohack': 'biohacking',
    'hormone': 'hormones',
    'telomere': 'longevity',
    'senolytic': 'longevity',
    'metformin': 'longevity',
    'resveratrol': 'longevity',
    'cognitive': 'mental performance',
    'memory': 'mental performance',
    'focus': 'mental performance',
    'anxiety': 'mental health',
    'depression': 'mental health',
    'workout': 'fitness',
    'recovery': 'fitness recovery',
    'muscle': 'fitness',
    'hypertrophy': 'fitness',
    'intermittent fasting': 'nutrition',
    'keto': 'nutrition',
    'probiotic': 'gut health',
    'microbiome': 'gut health',
    'blood sugar': 'diabetes',
    'insulin': 'diabetes',
    'glucose': 'diabetes',
    'cholesterol': 'heart health',
    'blood pressure': 'heart health',
    'cardiovascular': 'heart health',
    'vitamin d': 'vitamin',
    'magnesium': 'supplements',
    'zinc': 'supplements',
    'omega': 'supplements'
  };
  
  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (text.includes(keyword)) {
      found.push(category);
    }
  }
  
  return [...new Set(found)];
}

function clusterPosts(posts) {
  const clusters = {};
  
  for (const post of posts) {
    const keywords = post.keywords || [];
    const primaryKeyword = keywords[0] || 'general';
    
    if (!clusters[primaryKeyword]) {
      clusters[primaryKeyword] = [];
    }
    clusters[primaryKeyword].push(post);
  }
  
  const trends = [];
  
  for (const [topic, items] of Object.entries(clusters)) {
    if (items.length < 1) continue;
    
    const avgUpvotes = items.reduce((a, b) => a + b.upvotes, 0) / items.length;
    const totalComments = items.reduce((a, b) => a + b.comments, 0);
    const subreddits = [...new Set(items.map(i => i.subreddit))];
    const itemKeywords = items.flatMap(i => i.keywords || []);
    
    const titleWords = items.map(i => i.title.toLowerCase());
    const commonWords = findCommonWords(titleWords);
    
    let trendTopic = topic;
    if (commonWords.length > 0) {
      trendTopic = formatTrendTopic(commonWords[0], topic);
    }
    
    trends.push({
      trend_topic: trendTopic,
      description: items[0].title.substring(0, 100),
      example_posts: items.slice(0, 3).map(i => i.title.substring(0, 80)),
      engagement_score: Math.round(avgUpvotes),
      total_engagement: Math.round(avgUpvotes + totalComments / 10),
      subreddits: subreddits,
      post_count: items.length,
      keywords: [...new Set(itemKeywords)]
    });
  }
  
  trends.sort((a, b) => b.engagement_score - a.engagement_score);
  
  return trends;
}

function findCommonWords(titles) {
  const words = {};
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'in', 'on', 'at', 'i', 'my', 'me', 'you', 'your', 'it', 'this', 'that', 'what', 'how', 'why', 'when', 'with', 'and', 'or', 'but', 'be', 'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'should', 'would', 'will', 'just', 'like', 'get', 'got', 'been', 'being', 'anyone', 'someone', 'people'];
  
  for (const title of titles) {
    const tokens = title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    for (const token of tokens) {
      if (token.length > 3 && !stopWords.includes(token)) {
        words[token] = (words[token] || 0) + 1;
      }
    }
  }
  
  return Object.entries(words)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
}

function formatTrendTopic(keyword, category) {
  const formats = {
    'creatine': 'Creatine Benefits',
    'caffeine': 'Caffeine Effects',
    'sleep': 'Sleep Optimization',
    'nootropic': 'Nootropics & Cognitive',
    'biohack': 'Biohacking',
    'hormone': 'Hormone Optimization',
    'mental': 'Mental Health',
    'fitness': 'Fitness & Training',
    'recovery': 'Recovery & Rest',
    'nutrition': 'Nutrition & Diet',
    'diabetes': 'Blood Sugar & Diabetes',
    'heart': 'Heart Health',
    'supplement': 'Supplement Stack',
    'vitamin': 'Vitamin & Minerals',
    'longevity': 'Longevity & Anti-Aging',
    'default': keyword.charAt(0).toUpperCase() + keyword.slice(1) + ' Trends'
  };
  
  return formats[category] || formats.default || formats[keyword] || `${keyword} Health Trends`;
}

function processRedditPosts(posts) {
  const filtered = [];
  
  for (const post of posts) {
    const ageHours = post.age_hours || ((Date.now() / 1000 - (post.created_utc || 0)) / 3600);
    
    if (post.upvotes >= 50 && post.comments >= 10 && ageHours < 72) {
      if (!isLowQuality(post.title, post.selftext)) {
        if (isHealthRelated(post.title, post.selftext)) {
          filtered.push({
            ...post,
            keywords: extractKeywords(post.title, post.selftext),
            age_hours: ageHours
          });
        }
      }
    }
  }
  
  const trends = clusterPosts(filtered);
  
  return {
    processed_at: new Date().toISOString(),
    total_posts_analyzed: posts.length,
    posts_after_filter: filtered.length,
    trends: trends
  };
}

function saveTrendsToDatabase(trends) {
  const saved = [];
  
  for (const trend of trends.slice(0, 20)) {
    try {
      run(`
        INSERT INTO trends (
          topic_name, category, source, source_url,
          engagement_score, growth_rate, description,
          collected_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), 'new')
      `, [
        trend.trend_topic,
        'health',
        'reddit_trend',
        trend.example_posts[0] || '',
        Math.min(trend.engagement_score, 100),
        Math.round(trend.total_engagement / 10),
        `${trend.post_count} posts | ${trend.subreddits.join(', ')}`
      ]);
      saved.push(trend.trend_topic);
    } catch (e) {
      console.log('Error saving trend:', e.message);
    }
  }
  
  return saved;
}

async function getTrendAnalysis() {
  await initDB();
  
  const trends = all(`
    SELECT 
      id,
      topic_name,
      description,
      source,
      engagement_score,
      growth_rate,
      collected_date
    FROM trends 
    WHERE collected_date = date('now')
    AND source IN ('reddit', 'news')
    ORDER BY engagement_score DESC
    LIMIT 100
  `);
  
  const posts = trends.map(t => ({
    title: t.topic_name,
    selftext: t.description || '',
    upvotes: t.engagement_score * 10,
    comments: Math.round(t.growth_rate * 5),
    subreddit: t.source,
    age_hours: 24
  }));
  
  return processRedditPosts(posts);
}

module.exports = {
  processRedditPosts,
  saveTrendsToDatabase,
  getTrendAnalysis,
  isHealthRelated,
  isLowQuality,
  extractKeywords
};
