const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getBackupFilename(prefix = 'backup') {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  return `${prefix}_${date}_${time}`;
}

function backupDatabase() {
  return new Promise(async (resolve, reject) => {
    try {
      ensureBackupDir();
      
      const dbPath = path.join(__dirname, '..', 'database', 'data', 'trends.db');
      const backupName = getBackupFilename('db');
      const backupPath = path.join(BACKUP_DIR, `${backupName}.db`);
      
      if (!fs.existsSync(dbPath)) {
        logger.warn('No database file found to backup');
        resolve(null);
        return;
      }
      
      fs.copyFileSync(dbPath, backupPath);
      
      const stats = fs.statSync(backupPath);
      logger.info(`Database backed up: ${backupPath} (${Math.round(stats.size / 1024)}KB)`);
      
      resolve(backupPath);
    } catch (e) {
      logger.error('Backup failed:', e);
      reject(e);
    }
  });
}

function backupConfig() {
  try {
    ensureBackupDir();
    
    const configPath = path.join(__dirname, '..', 'config.json');
    const backupName = getBackupFilename('config');
    const backupPath = path.join(BACKUP_DIR, `${backupName}.json`);
    
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, backupPath);
      logger.info(`Config backed up: ${backupPath}`);
    }
    
    return backupPath;
  } catch (e) {
    logger.error('Config backup failed:', e);
    return null;
  }
}

function listBackups(type = 'all') {
  try {
    ensureBackupDir();
    
    let files = fs.readdirSync(BACKUP_DIR);
    
    if (type !== 'all') {
      files = files.filter(f => f.startsWith(type));
    }
    
    return files
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          path: filePath,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => b.created - a.created);
  } catch (e) {
    logger.error('List backups error:', e);
    return [];
  }
}

function restoreDatabase(backupFile) {
  return new Promise(async (resolve, reject) => {
    try {
      const backupPath = path.join(BACKUP_DIR, backupFile);
      const dbPath = path.join(__dirname, '..', 'database', 'data', 'trends.db');
      
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }
      
      fs.copyFileSync(backupPath, dbPath);
      logger.info(`Database restored from: ${backupFile}`);
      
      resolve(true);
    } catch (e) {
      logger.error('Restore failed:', e);
      reject(e);
    }
  });
}

function cleanupOldBackups(maxFiles = 10, maxAgeDays = 30) {
  try {
    const backups = listBackups();
    const now = new Date();
    
    let deleted = 0;
    
    for (const backup of backups) {
      const ageDays = (now - backup.created) / (1000 * 60 * 60 * 24);
      
      if (backups.length > maxFiles || ageDays > maxAgeDays) {
        fs.unlinkSync(backup.path);
        deleted++;
        logger.info(`Deleted old backup: ${backup.name}`);
      }
    }
    
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old backups`);
    }
    
    return deleted;
  } catch (e) {
    logger.error('Cleanup error:', e);
    return 0;
  }
}

async function fullBackup() {
  try {
    logger.info('Starting full backup...');
    
    const dbPath = await backupDatabase();
    const configPath = backupConfig();
    
    cleanupOldBackups();
    
    logger.info('Full backup completed');
    
    return {
      database: dbPath,
      config: configPath,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    logger.error('Full backup failed:', e);
    return null;
  }
}

module.exports = {
  backupDatabase,
  backupConfig,
  listBackups,
  restoreDatabase,
  cleanupOldBackups,
  fullBackup
};
