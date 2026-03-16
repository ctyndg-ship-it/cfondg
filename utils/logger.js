const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, `app_${new Date().toISOString().split('T')[0]}.log`);

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'info',
  maxLogSize: 10 * 1024 * 1024,
  maxFiles: 7
};

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (data) {
    if (data instanceof Error) {
      logMessage += `\n  Stack: ${data.stack}`;
    } else if (typeof data === 'object') {
      logMessage += `\n  Data: ${JSON.stringify(data)}`;
    } else {
      logMessage += ` ${data}`;
    }
  }
  
  return logMessage;
}

function writeToFile(message) {
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, message + '\n', 'utf8');
  } catch (e) {
    console.error('Failed to write to log file:', e.message);
  }
}

function log(level, message, data = null) {
  if (LOG_LEVELS[level] > LOG_LEVELS[CONFIG.logLevel]) {
    return;
  }

  const formatted = formatMessage(level, message, data);
  
  const colors = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[36m',
    debug: '\x1b[90m',
    reset: '\x1b[0m'
  };

  console.log(`${colors[level] || ''}${formatted}${colors.reset}`);
  writeToFile(formatted);
}

const logger = {
  error: (message, data) => log('error', message, data),
  warn: (message, data) => log('warn', message, data),
  info: (message, data) => log('info', message, data),
  debug: (message, data) => log('debug', message, data)
};

function rotateLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('app_') && f.endsWith('.log'))
      .sort()
      .reverse();

    if (files.length > CONFIG.maxFiles) {
      const toDelete = files.slice(CONFIG.maxFiles);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(LOG_DIR, file));
        logger.info(`Deleted old log: ${file}`);
      }
    }
  } catch (e) {
    console.error('Log rotation error:', e.message);
  }
}

function getLogs(lines = 100) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    return content.split('\n').filter(l => l.trim()).slice(-lines);
  } catch (e) {
    return [];
  }
}

function clearOldLogs(days = 30) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('app_') && f.endsWith('.log'));
    
    for (const file of files) {
      const dateStr = file.replace('app_', '').replace('.log', '');
      const fileDate = new Date(dateStr);
      
      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, file));
        logger.info(`Deleted old log: ${file}`);
      }
    }
  } catch (e) {
    logger.error('Clear logs error:', e);
  }
}

function logSystemStats() {
  const mem = process.memoryUsage();
  logger.info('System Stats', {
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`
    },
    uptime: `${Math.round(process.uptime() / 60)} minutes`
  });
}

module.exports = {
  logger,
  rotateLogs,
  getLogs,
  clearOldLogs,
  logSystemStats
};
