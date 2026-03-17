const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { run, all, get, initDB } = require('../database/db');
const axios = require('axios');

const STYLE_GUIDE = {
  name: 'DrKiller - Aggressive Vulgar Health',
  tone: 'aggressive, confrontational, dark humor, unapologetic, edgy, sarcastic, uses heavy profanity',
  keywords: ['bitch-ass', 'dumb-ass', 'fuck', 'fat ass', 'motherfucker', 'shit', ' goddamn', 'soggy', 'useless', 'bitch', 'dumbass', 'shitty', 'pussy', 'lucky', 'cringy', 'freak', 'pissed', 'bullshit', 'ass', 'horny', 'cum', 'balls', 'dick', 'pussy', 'retarded', 'mongoloid', 'mongol'],
  structure: 'HOOK (shocking question) → EXPLANATION (dark humor) → DETAILS (facts) → WHAT TO DO → DISCLAIMER → CTA',
  cta_pattern: 'Follow me for more about your [fucked up/malfunctioning/broken-ass] body.',
  forbidden_words: ['delve', 'unleash', 'comprehensive', 'embark', 'journey', 'transformative', 'revolutionary', 'leverage', 'optimize', 'seamless', 'utilize', 'facilitate'],
  word_count: '280-350 words for short-form video'
};

const REFERENCE_SCRIPTS = `
LEARN FROM THESE 10 VIRAL TIKTOK SCRIPTS - COPY THEIR STYLE EXACTLY:

1. "What does vaping do to your bitch-ass body? You thought it was just flavored fucking air, mango mist and blueberry bullshit, right? That little stick of death is pumping nicotine straight into your bloodstream, clenching your arteries like a damn vise grip and slowly turning your heart into soggy, useless beef jerky. Fast forward, you're in a hospital bed, tubes in your arms, oxygen jammed up your nose, you can't move, you can't breathe. Dr. Walks in and says, your heart's working at 3% bitch, beside the fucking nicotine addiction, lung irritation, and increased anxiety. Your heart could end up fucked. Is vaping better than smoking cigarettes? Who the fuck knows at this point? But I wouldn't press my fucking luck until more studies are conducted."

2. "How the fuck does an inhaler work? When you're fucking lungs start acting like two pieces of shit, an inhaler blasts pressurized medicine, usually albuterol, straight down your throat into those bitch ass airways that decided to clamp shut like a scared fucking turtle. The god damn albuterol binds to beta-2 receptors on the muscles wrapped around your bronchial tubes and tells them to chill the fuck out. And boom, those tight airways open up so you can get a nice fat fucking breath of fresh air again."

3. "What the fuck is sleep apnea? Sleep apnea is when your dumbass throat collapses like a folding chair. The second you fall asleep — while you're awake, your throat muscles hold the piece-of-shit airway open; But when you fall asleep, the throat muscles pass out too — letting that shit close up tighter than your ex's fucking heart. Air barely squeezes through, making your soft palate vibrate like a dying lawnmower. That's snoring."

4. "What the actual fuck happens when you walk for an hour? After two minutes blood circulation kicks in, heart rate goes up, and your body is praying that you're about to exercise. By five minutes, your mood lifts noticeably, thanks to a hit of endorphins, telling your brain your pathetic ass isn't getting up to eat. At 30 minutes, your huge body switches gears and starts burning stored fat for fuel. Holy shit, exercise actually works. At 60 minutes, boom, your brain has a many fucking orgasm flooding with dopamine and serotonin."

5. "If your bitch ass takes a cold shower every day for two weeks, here's what will happen. Days one to three, brutal. Your body goes into full shock. Behind the scenes, your blood vessels rapidly contract like your fat ass grip in a burger, which forces blood to your vital organs, triggering a fucking massive release of norepinephrine, boosting your alertness by 530%. Days four to seven, your body starts producing a shit ton of white blood cells strengthening your pathetic immune system."

6. "Why the fuck is magnesium so important? Your dumbass body needs magnesium for over 300 biochemical reactions. But most people are walking around with a magnesium deficiency, feeling like absolute shit. Muscle cramps, anxiety, insomnia, headaches — your body is screaming for magnesium but you're ignoring it like it's your ex's texts. Leafy greens, nuts, seeds — eat that shit or suffer the consequences, dumbass."

7. "What happens if you don't sleep for 72 hours? After 24 hours, your brain starts hallucinating like you're on a bad acid trip. Your reaction time is worse than a drunk driver. After 48 hours, your immune system completely tanks — white blood cells drop by 50%. After 72 hours, your brain starts shutting down, you can't form memories, you're seeing shit that isn't there. Sleep is not optional, you stupid bastard."

8. "The truth about intermittent fasting. Your dumbass thinks skipping breakfast makes you healthy? Intermittent fasting is just eating in a shorter window, not some magical weight loss hack. If you eat 4000 calories in 8 hours, you're still getting fat, you dumbfuck. The only benefit is calorie awareness. Stop treating IF like it's religion, dumbass."

9. "What does stress do to your body? Chronic stress is slowly killing you and you don't even know it. Cortisol floods your system, breaking down muscle, storing fat around your belly like a beer gut. Your immune system shuts down. You're getting sick all the time. Your relationships are dying. You're losing hair. All because you can't manage stress like an adult, you pathetic excuse for a human being."

10. "The真相 about protein. You think eating 200 grams of protein a day makes you a gym god? Your dumbass kidneys are crying. Too much protein strains your kidneys, causes dehydration, and makes you constipated as hell. The average person needs 0.8-1 gram per kg, not this 2 grams per kg bullshit fitness influencers are pushing. Stop over-consuming like a pig, dumbass."
`;

const AI_PROMPT = `You are a health content creator known for viral TikTok/Reels/Shorts. Write scripts in the EXACT short, punchy style of these viral examples. USE HEAVY PROFANITY like the examples.

${REFERENCE_SCRIPTS}

⚠️ CRITICAL RULES:
1. COPY THE SHORT, PUNCHY STYLE from examples - short sentences, no long paragraphs
2. Stay 100% FOCUSED on ONE specific health topic only
3. ONLY state facts you are CONFIDENT are scientifically accurate
4. NEVER make up statistics or medical claims
5. NO HEADINGS like **HOOK:** or **EXPLANATION:** - just write naturally like the examples!
6. Write in one continuous flow, NOT structured sections
7. NO DISCLAIMER - don't mention "consult your doctor" or medical advice

WRITE LIKE THE EXAMPLES - raw, conversational, no formatting:
- Short sentences. No long paragraphs.
- No **HOOK:** or **EXPLANATION:** labels
- Use profanity: bitch, fuck, shit, dumbass, ass, goddamn, pathetic
- Dark humor, compare to gross stuff
- Sound like you're ranting
- 200-280 words MAX. Don't be wordy.

TOPIC: {topic}
CONTEXT: {context}

WRITE RAW - no sections, no disclaimer, no medical advice - just flow naturally like a viral TikTok!`;

const TEMPLATES = {
  intro_patterns: [
    'What the fuck is {topic}?',
    'What the fuck does {topic} do to your bitch-ass body?',
    'How the fuck does {topic} work?',
    'If your dumb-ass {topic} every day, here\'s what happens.',
    'What the actual fuck is {topic}?',
    'Here\'s what happens when your pathetic ass gets {topic}',
    'Why the fuck is {topic} so underrated?',
    'If your lazy ass ignores {topic}, here\'s what\'ll happen'
  ],
  cta_patterns: [
    'Follow me for more about your [fucked up/malfunctioning/broken-ass] body.',
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
  
  // Parse metadata for context
  let context = '';
  try {
    if (trend.metadata) {
      const meta = typeof trend.metadata === 'string' ? JSON.parse(trend.metadata) : trend.metadata;
      
      // YouTube: description + hashtags (NOT views/likes - those are just for filtering)
      if (trend.source === 'youtube') {
        if (meta.description) {
          context += `Video description: ${meta.description.substring(0, 500)}. `;
        }
        if (meta.hashtags && meta.hashtags.length > 0) {
          context += `Hashtags: ${meta.hashtags.join(', ')}. `;
        }
      }
      
      // Reddit: post body + health-related comments only
      if (trend.source === 'reddit') {
        if (meta.post_body) {
          context += `Reddit post: ${meta.post_body.substring(0, 300)}. `;
        }
        // Only include comments that are health-related
        if (meta.top_comments && meta.top_comments.length > 0) {
          const healthComments = meta.top_comments.filter(c => {
            const lower = c.toLowerCase();
            return lower.includes('health') || lower.includes('vitamin') || lower.includes('diet') || 
                   lower.includes('exercise') || lower.includes('sleep') || lower.includes('mental') ||
                   lower.includes('weight') || lower.includes('nutrition') || lower.includes('supplement');
          });
          if (healthComments.length > 0) {
            context += `Top health comments: ${healthComments.join(' | ').substring(0, 200)}. `;
          }
        }
      }
      
      // News: title + article description
      if (trend.source === 'news') {
        context += `Article title: ${topic}. `;
        if (meta.article_description) {
          context += `Article summary: ${meta.article_description.substring(0, 500)}. `;
        }
      }
    }
  } catch (e) {
    context = trend.description || '';
  }
  
  if (!context) {
    context = trend.description || '';
  }
  
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
