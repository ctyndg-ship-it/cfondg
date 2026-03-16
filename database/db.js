const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'trends.db');
let db = null;

async function initDB() {
  const SQL = await initSqlJs();

  let fileBuffer = null;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
  }

  db = new SQL.Database(fileBuffer);

  db.run(`
    CREATE TABLE IF NOT EXISTS trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_name TEXT NOT NULL,
      category TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT,
      engagement_score INTEGER DEFAULT 0,
      growth_rate REAL DEFAULT 0,
      description TEXT,
      discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      collected_date DATE DEFAULT (date('now')),
      status TEXT DEFAULT 'new'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trend_id INTEGER,
      topic_name TEXT NOT NULL,
      full_script TEXT NOT NULL,
      hashtags TEXT,
      source_link TEXT,
      duration INTEGER DEFAULT 30,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trend_id) REFERENCES trends(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date DATE UNIQUE,
      total_trends INTEGER,
      hot_topics TEXT,
      generated_scripts INTEGER,
      report_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS style_guide (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tone TEXT,
      keywords TEXT,
      structure TEXT,
      sample_content TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    db.run(`ALTER TABLE scripts ADD COLUMN duration INTEGER DEFAULT 30`);
    db.run(`ALTER TABLE scripts ADD COLUMN notes TEXT`);
    db.run(`ALTER TABLE scripts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  } catch(e) {}

  saveDB();
  console.log('✅ Database initialized successfully!');
  console.log('📁 Database location:', dbPath);

  return db;
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(dbPath, buffer);
  }
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function get(sql, params = []) {
  const results = all(sql, params);
  return results[0] || null;
}

module.exports = {
  initDB,
  run,
  all,
  get,
  saveDB
};
