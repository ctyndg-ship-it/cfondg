const { run, all, get, initDB, saveDB } = require('../database/db');

function initPipelineDB() {
  run(`
    CREATE TABLE IF NOT EXISTS video_pipeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      script_id INTEGER,
      topic_name TEXT NOT NULL,
      status TEXT DEFAULT 'script_ready',
      script_text TEXT,
      audio_url TEXT,
      audio_duration INTEGER,
      video_url TEXT,
      video_path TEXT,
      thumbnail_url TEXT,
      duration INTEGER,
      platform TEXT,
      posted_url TEXT,
      posted_at DATETIME,
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      error_message TEXT,
      priority INTEGER DEFAULT 5,
      scheduled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (script_id) REFERENCES scripts(id)
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS pipeline_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE DEFAULT (date('now')),
      scripts_created INTEGER DEFAULT 0,
      audio_generated INTEGER DEFAULT 0,
      videos_created INTEGER DEFAULT 0,
      videos_posted INTEGER DEFAULT 0,
      total_views INTEGER DEFAULT 0,
      total_likes INTEGER DEFAULT 0
    )
  `);

  console.log('✅ Video Pipeline tables initialized');
}

function createVideoJob(scriptId, topicName, scriptText, priority = 5) {
  const existing = get(`SELECT id FROM video_pipeline WHERE script_id = ?`, [scriptId]);
  if (existing) {
    console.log('⚠️ Video job already exists for this script');
    return existing.id;
  }

  run(`
    INSERT INTO video_pipeline (script_id, topic_name, script_text, status, priority)
    VALUES (?, ?, ?, 'script_ready', ?)
  `, [scriptId, topicName, scriptText, priority]);

  const job = get(`SELECT id FROM video_pipeline WHERE script_id = ?`, [scriptId]);
  console.log(`📹 Created video job #${job.id} for: ${topicName}`);
  return job.id;
}

function updateJobStatus(jobId, status, data = {}) {
  const fields = ['status = ?', 'updated_at = datetime("now")'];
  const values = [status];

  if (data.audio_url) {
    fields.push('audio_url = ?');
    values.push(data.audio_url);
  }
  if (data.audio_duration) {
    fields.push('audio_duration = ?');
    values.push(data.audio_duration);
  }
  if (data.video_url) {
    fields.push('video_url = ?');
    values.push(data.video_url);
  }
  if (data.video_path) {
    fields.push('video_path = ?');
    values.push(data.video_path);
  }
  if (data.thumbnail_url) {
    fields.push('thumbnail_url = ?');
    values.push(data.thumbnail_url);
  }
  if (data.duration) {
    fields.push('duration = ?');
    values.push(data.duration);
  }
  if (data.error_message) {
    fields.push('error_message = ?');
    values.push(data.error_message);
  }
  if (data.posted_url) {
    fields.push('posted_url = ?');
    values.push(data.posted_url);
    fields.push('posted_at = datetime("now")');
  }

  values.push(jobId);

  run(`UPDATE video_pipeline SET ${fields.join(', ')} WHERE id = ?`, values);
  console.log(`📹 Job #${jobId} status: ${status}`);
}

function getJobByStatus(status) {
  return all(`SELECT * FROM video_pipeline WHERE status = ? ORDER BY priority DESC, created_at ASC`, [status]);
}

function getNextJob() {
  return get(`
    SELECT * FROM video_pipeline 
    WHERE status IN ('script_ready', 'audio_ready', 'video_ready')
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
  `);
}

function getAllJobs(limit = 50) {
  return all(`
    SELECT * FROM video_pipeline 
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit]);
}

function getJobsByStatus() {
  const statuses = ['script_ready', 'audio_generating', 'audio_ready', 'video_generating', 'video_ready', 'rendering', 'posted', 'failed'];
  const result = {};
  
  for (const status of statuses) {
    const count = get(`SELECT COUNT(*) as count FROM video_pipeline WHERE status = ?`, [status]);
    result[status] = count?.count || 0;
  }
  
  return result;
}

function recordPostMetrics(jobId, views, likes, comments, shares) {
  run(`
    UPDATE video_pipeline 
    SET views = ?, likes = ?, comments = ?, shares = ?
    WHERE id = ?
  `, [views, likes, comments, shares, jobId]);
}

function getPipelineStats(days = 7) {
  return all(`
    SELECT * FROM pipeline_stats 
    ORDER BY date DESC
    LIMIT ?
  `, [days]);
}

function updateDailyStats() {
  const today = new Date().toISOString().split('T')[0];
  
  const stats = {
    scripts_created: get(`SELECT COUNT(*) as c FROM scripts WHERE date(generated_at) = ?`, [today])?.c || 0,
    audio_generated: get(`SELECT COUNT(*) as c FROM video_pipeline WHERE date(updated_at) = ? AND status IN ('audio_ready', 'video_ready', 'posted')`, [today])?.c || 0,
    videos_created: get(`SELECT COUNT(*) as c FROM video_pipeline WHERE date(updated_at) = ? AND status IN ('video_ready', 'posted')`, [today])?.c || 0,
    videos_posted: get(`SELECT COUNT(*) as c FROM video_pipeline WHERE date(posted_at) = ?`, [today])?.c || 0,
    total_views: get(`SELECT SUM(views) as v FROM video_pipeline WHERE date(updated_at) = ?`, [today])?.v || 0,
    total_likes: get(`SELECT SUM(likes) as l FROM video_pipeline WHERE date(updated_at) = ?`, [today])?.l || 0
  };

  run(`
    INSERT OR REPLACE INTO pipeline_stats (date, scripts_created, audio_generated, videos_created, videos_posted, total_views, total_likes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [today, stats.scripts_created, stats.audio_generated, stats.videos_created, stats.videos_posted, stats.total_views, stats.total_likes]);

  return stats;
}

function createJobsFromScripts() {
  const scripts = all(`
    SELECT id, topic_name, full_script 
    FROM scripts 
    WHERE date(generated_at) = date('now')
    AND id NOT IN (SELECT script_id FROM video_pipeline WHERE script_id IS NOT NULL)
  `);

  let created = 0;
  for (const script of scripts) {
    createVideoJob(script.id, script.topic_name, script.full_script, 5);
    created++;
  }

  console.log(`📹 Created ${created} video jobs from today's scripts`);
  return created;
}

module.exports = {
  initPipelineDB,
  createVideoJob,
  updateJobStatus,
  getJobByStatus,
  getNextJob,
  getAllJobs,
  getJobsByStatus,
  recordPostMetrics,
  getPipelineStats,
  updateDailyStats,
  createJobsFromScripts
};
