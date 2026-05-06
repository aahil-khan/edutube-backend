const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const minimumLevel = process.env.LOG_LEVEL || 'info';
const minimumLevelIndex = LOG_LEVELS.indexOf(minimumLevel);

function shouldLog(level) {
  const currentLevelIndex = LOG_LEVELS.indexOf(level);
  if (currentLevelIndex === -1 || minimumLevelIndex === -1) {
    return true;
  }
  return currentLevelIndex >= minimumLevelIndex;
}

function writeLog(level, args) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    service: process.env.APP_NAME || 'edutube-backend',
    instance: process.env.INSTANCE_ID || process.env.HOSTNAME || 'unknown',
    msg: args
      .map((arg) => (arg instanceof Error ? arg.stack || arg.message : arg))
      .join(' '),
  };

  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

const logger = {
  log: (...args) => writeLog('info', args),
  info: (...args) => writeLog('info', args),
  warn: (...args) => writeLog('warn', args),
  error: (...args) => writeLog('error', args),
  debug: (...args) => writeLog('debug', args),
};

export default logger;
