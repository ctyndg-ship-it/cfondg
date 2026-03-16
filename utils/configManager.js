const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

const DEFAULT_CONFIG = {
  system: {
    logLevel: 'info',
    scheduleTime: '0 6 * * *',
    autoRun: true,
    maxTrendsPerDay: 50,
    maxScriptsPerDay: 10
  },
  crawler: {
    sources: ['google_trends', 'reddit', 'tiktok', 'twitter', 'news'],
    minEngagementScore: 30,
    languages: ['en'],
    categories: ['health', 'fitness', 'nutrition', 'mental_health']
  },
  script: {
    useAI: true,
    aiModel: 'gpt-4o-mini',
    defaultDuration: 30,
    tone: 'aggressive',
    maxRetries: 3
  },
  video: {
    defaultPlatform: 'tiktok',
    voiceId: 'rachel',
    resolution: '1080x1920',
    fps: 30,
    aspectRatio: '9:16'
  },
  storage: {
    keepTrendsDays: 90,
    keepScriptsDays: 30,
    keepVideosDays: 14,
    autoBackup: true,
    backupIntervalHours: 24
  },
  notifications: {
    enabled: false,
    telegram: {
      botToken: '',
      chatId: ''
    },
    discord: {
      webhookUrl: ''
    }
  }
};

let config = null;

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const fileContent = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = { ...DEFAULT_CONFIG, ...JSON.parse(fileContent) };
      console.log('✅ Config loaded from file');
    } else {
      config = DEFAULT_CONFIG;
      saveConfig();
      console.log('✅ Default config created');
    }
  } catch (e) {
    console.error('❌ Config load error:', e.message);
    config = DEFAULT_CONFIG;
  }
  
  return config;
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('✅ Config saved');
  } catch (e) {
    console.error('❌ Config save error:', e.message);
  }
}

function getConfig(path = '') {
  if (!config) loadConfig();
  
  if (!path) return config;
  
  const keys = path.split('.');
  let value = config;
  
  for (const key of keys) {
    value = value?.[key];
  }
  
  return value;
}

function setConfig(path, value) {
  if (!config) loadConfig();
  
  const keys = path.split('.');
  let obj = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    obj[keys[i]] = obj[keys[i]] || {};
    obj = obj[keys[i]];
  }
  
  obj[keys[keys.length - 1]] = value;
  saveConfig();
}

function resetConfig() {
  config = DEFAULT_CONFIG;
  saveConfig();
  console.log('✅ Config reset to defaults');
}

function exportConfig() {
  return JSON.stringify(config, null, 2);
}

function importConfig(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    config = { ...DEFAULT_CONFIG, ...imported };
    saveConfig();
    return true;
  } catch (e) {
    console.error('❌ Config import error:', e.message);
    return false;
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  setConfig,
  resetConfig,
  exportConfig,
  importConfig,
  DEFAULT_CONFIG
};
