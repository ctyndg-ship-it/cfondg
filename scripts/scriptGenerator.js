require('dotenv').config();
const { run, all, get, initDB } = require('../database/db');
const axios = require('axios');

const STYLE_GUIDE = {
  name: 'Aggressive Vulgar Health',
  tone: 'aggressive, confrontational, dark humor, unapologetic, edgy',
  keywords: ['bitch-ass', 'dumb-ass', 'fuck', 'fat ass', 'motherfucker', 'shit', ' goddamn', 'soggy', 'useless beef jerky', 'bitch', 'dumbass'],
  structure: 'Hook -> Problem -> Solution/Information -> CTA',
  cta_pattern: 'Follow me for more about your [fucked up/malfunctioning/broken-ass] body.',
  forbidden_words: ['delve', 'unleash', 'comprehensive', 'embark', 'journey', 'transformative', 'revolutionary', 'leverage', 'optimize', 'seamless'],
  word_count: '200-250 words for short-form video'
};

const AI_PROMPT = `You are a responsible health content creator with medical ethics. Write a short-form video script in English (280-350 words) for TikTok/Reels/Shorts.

⚠️ CRITICAL RULES - MUST FOLLOW:
1. Stay 100% FOCUSED on ONE specific health topic only
2. ONLY state facts you are CONFIDENT are scientifically accurate
3. When unsure, say "research suggests" or "some studies indicate" - never state unverified claims as facts
4. Always include disclaimer: "Consult your doctor for personalized advice"
5. NEVER make up statistics, dosages, or medical claims

STRUCTURE (MUST FOLLOW - Total 60-90 seconds when read):
1. HOOK (5-8 seconds): One shocking fact or question about [topic] - grab attention immediately
2. EXPLAIN (25-35 seconds): What it is, key facts, who it affects - stay on ONE point
3. SIGNS/SYMPTOMS (15-20 seconds): 3-5 specific warning signs people should watch for
4. WHAT TO DO (15-20 seconds): 2-3 evidence-based recommendations with caveats
5. DISCLAIMER (3-5 seconds): "This is for educational purposes. Talk to your doctor."
6. CTA (5 seconds): "Follow for more science-based health info"

TOPIC: {topic}
CONTEXT: {context}

IMPORTANT:
- Keep it SHORT and SNAPPY for video
- Pick ONE aspect of the topic and go deep, don't jump around
- Use general phrases like "studies suggest", "research indicates", "health experts recommend"
- If topic is too broad (like "cancer"), narrow down to specific type
- Write 280-350 words. Each section should be concise and punchy.`;

const TEMPLATES = {
  intro_patterns: [
    'What the fuck is {topic}?',
    'What the fuck does {topic} do to your bitch-ass body?',
    'How the fuck does {topic} work?',
    'If your dumb-ass {topic} every day, here\'s what happens.',
    'What the actual fuck is {topic}?'
  ],
  cta_patterns: [
    'Follow for more real health facts. No bullshit.',
    'Save this. Share this. Your friends need to know.',
    'Follow for more truth about your health.',
    'Get real facts, not influencer bullshit.',
    'More evidence-based health content coming. Follow.'
  ]
};

function getRandomIntro(topic) {
  const pattern = TEMPLATES.intro_patterns[Math.floor(Math.random() * TEMPLATES.intro_patterns.length)];
  return pattern.replace('{topic}', topic.toLowerCase());
}

function getRandomCTA() {
  return TEMPLATES.cta_patterns[Math.floor(Math.random() * TEMPLATES.cta_patterns.length)];
}

function generateHashtags(topic, count = 8) {
  const topicLower = topic.toLowerCase();
  const base = [];
  
  // Health-focused hashtags
  const healthTags = ['#health', '#healthtips', '#healthylifestyle', '#wellness'];
  const conditionTags = [];
  
  // Extract relevant hashtags from topic
  const words = topicLower.split(/[\s,\-]/);
  for (const word of words) {
    if (word.length > 3 && word.length < 20) {
      if (['diabetes', 'cancer', 'heart', 'mental', 'anxiety', 'depression', 'weight', 'sleep', 'nutrition', 'vitamin', 'blood', 'cancer'].some(k => word.includes(k))) {
        conditionTags.push(`#${word}`);
      }
    }
  }
  
  // Add relevant tags
  if (topicLower.includes('diabetes')) conditionTags.push('#diabetes', '#bloodsugar', '#type2');
  if (topicLower.includes('heart')) conditionTags.push('#hearthealth', '#cardio');
  if (topicLower.includes('mental')) conditionTags.push('#mentalhealth', '#mentalwellness');
  if (topicLower.includes('weight')) conditionTags.push('#weightloss', '#fitness');
  if (topicLower.includes('cancer')) conditionTags.push('#cancer', '#oncology');
  if (topicLower.includes('sleep')) conditionTags.push('#sleep', '#insomnia');
  
  // Combine and limit
  const allTags = [...new Set([...conditionTags, ...healthTags])].slice(0, count);
  
  return allTags.length > 0 ? allTags.join(' ') : healthTags.slice(0, count).join(' ');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWithAI(topic, context = '', duration = 30, retryCount = 0) {
  const prompt = AI_PROMPT
    .replace('{duration}', duration)
    .replace('{tone}', STYLE_GUIDE.tone)
    .replace('{forbidden}', STYLE_GUIDE.forbidden_words.join(', '))
    .replace('{topic}', topic)
    .replace('{context}', context || 'General health topic');

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here' || apiKey.length < 20) {
      console.log('⚠️ No valid OpenAI API key found, using template fallback');
      return null;
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 800
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data.choices[0]?.message?.content || null;
  } catch (error) {
    if (error.response?.status === 429 && retryCount < 3) {
      const waitTime = (retryCount + 1) * 2000;
      console.log(`⏳ Rate limited, waiting ${waitTime}ms...`);
      await delay(waitTime);
      return generateWithAI(topic, context, duration, retryCount + 1);
    }
    console.error('❌ AI Error:', error.message);
    return null;
  }
}

function generateTemplateScript(topic, context = '') {
  const topicLower = topic.toLowerCase();
  
  const content = `**[HOOK - 5 seconds]**
What the actual fuck is ${topicLower}? Let me tell you the truth.

**[EXPLAIN - 30 seconds]**
${topicLower} is something affecting millions. Here's what experts say: ${context || 'Research suggests it impacts overall health significantly.'}

**[WARNING SIGNS - 20 seconds]**
Watch for these signs:
- Sign 1 related to ${topicLower}
- Sign 2 related to ${topicLower}  
- Sign 3 - don't ignore this

**[WHAT TO DO - 20 seconds]**
Based on general health recommendations:
1. Consult a healthcare professional
2. Maintain healthy lifestyle
3. Don't self-diagnose

**[DISCLAIMER - 5 seconds]**
This is for educational purposes. Always consult your doctor for personalized medical advice.

**[CTA]**
Follow for more science-based health info. Save this!`;

  return content;
}

async function generateScriptForTrend(trend, useAI = true) {
  const topic = trend.topic_name;
  const context = trend.description || '';
  
  let fullScript;
  
  if (useAI) {
    fullScript = await generateWithAI(topic, context, 30);
  }
  
  if (!fullScript) {
    fullScript = generateTemplateScript(topic, context);
  }

  const hashtags = generateHashtags(topic);

  return {
    topic_name: topic,
    full_script: fullScript,
    hashtags: hashtags,
    source_link: trend.source_url,
    trend_id: trend.id,
    duration: 30,
    status: 'generated'
  };
}

function getTopTrends(limit = 50, minScore = 0) {
  let trends = all(`
    SELECT * FROM trends
    WHERE collected_date = date('now')
    AND (engagement_score + growth_rate) >= ?
    ORDER BY RANDOM()
    LIMIT ?
  `, [minScore, limit]);
  
  if (trends.length === 0) {
    trends = all(`
      SELECT * FROM trends
      WHERE (engagement_score + growth_rate) >= ?
      ORDER BY RANDOM()
      LIMIT ?
    `, [minScore, limit]);
  }
  
  return trends;
}

function getPendingScripts(limit = 10) {
  return all(`
    SELECT s.*, t.topic_name, t.description, t.source_url
    FROM scripts s
    LEFT JOIN trends t ON s.trend_id = t.id
    WHERE s.status = 'generated'
    ORDER BY s.id DESC
    LIMIT ?
  `, [limit]);
}

function saveGeneratedScripts(scripts) {
  let saved = 0;
  for (const script of scripts) {
    try {
      run(`
        INSERT INTO scripts (trend_id, topic_name, full_script, hashtags, source_link, status, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [script.trend_id, script.topic_name, script.full_script, script.hashtags, script.source_link, script.status, script.duration || 30]);
      saved++;
    } catch (e) {
      console.error('Error saving script:', e.message);
    }
  }
  console.log(`💾 Saved ${saved} new scripts`);
}

async function generateAllScripts(limit = 50, useAI = true) {
  console.log('\n🎬 === GENERATING SCRIPTS ===\n');
  console.log('🤖 AI Mode:', useAI);
  console.log('📊 Target:', limit, 'scripts');

  const trends = getTopTrends(limit);

  if (trends.length === 0) {
    console.log('⚠️ No trends found for today. Run crawler first!');
    return [];
  }

  console.log(`📝 Generating scripts for ${trends.length} topics...`);

  const scripts = [];
  for (const trend of trends) {
    const script = await generateScriptForTrend(trend, useAI);
    scripts.push(script);
    console.log(`   ✓ ${trend.topic_name}`);
    console.log(`   Script preview: ${script.full_script.substring(0, 80)}...`);
  }

  console.log('\n💾 Saving scripts to database...');
  saveGeneratedScripts(scripts);
  console.log(`✅ Generated ${scripts.length} scripts\n`);

  return scripts;
}

function getTodayScripts() {
  return all(`
    SELECT * FROM scripts
    WHERE date(generated_at) = date('now')
    ORDER BY id DESC
  `);
}

function getScriptsByStatus(status) {
  return all(`SELECT * FROM scripts WHERE status = ? ORDER BY generated_at DESC`, [status]);
}

function updateScriptStatus(scriptId, status, notes = '') {
  run(`UPDATE scripts SET status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`, [status, notes, scriptId]);
}

module.exports = {
  generateAllScripts,
  generateScriptForTrend,
  generateWithAI,
  getTopTrends,
  getTodayScripts,
  getPendingScripts,
  updateScriptStatus,
  getScriptsByStatus,
  STYLE_GUIDE
};
