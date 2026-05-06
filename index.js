import app from './src/app.js';
import logger from './src/utils/logger.js';

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});