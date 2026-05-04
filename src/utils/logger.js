/**
 * Logger utility that suppresses console output in production
 * Allows selective logging based on environment
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log('[LOG]', ...args);
    }
  },
  error: (...args) => {
    if (isDevelopment) {
      console.error('[ERROR]', ...args);
    }
  },
  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },
  info: (...args) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },
  debug: (...args) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  },
};

export default logger;
