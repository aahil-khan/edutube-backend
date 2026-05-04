import app from './src/app.js';
import logger from './src/utils/logger.js';

const PORT = process.env.PORT || 5001;

// Suppress console output in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
}

app.listen(PORT, () => {
    logger.log(`Server is running on port ${PORT}`);
});