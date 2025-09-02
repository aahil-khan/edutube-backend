import express from 'express';
import { addWatchHistory, getWatchHistory, getVideoProgress, getRecentActivity } from '../controllers/watchHistoryController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/watch-history', authenticateToken, addWatchHistory);
router.get('/watch-history', authenticateToken, getWatchHistory);
router.get('/watch-history/recent', authenticateToken, getRecentActivity);
router.get('/getVideoProgress/:lec_id', authenticateToken, getVideoProgress);

export default router;
