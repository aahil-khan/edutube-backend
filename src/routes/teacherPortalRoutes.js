import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireTeacher } from '../middleware/teacherAuth.js';
import {
    getMyInstances,
    getInstanceChapters,
    getInstanceAnalytics,
    getAnalyticsSummary,
    createChapterTeacher,
    updateChapterTeacher,
    reorderChaptersTeacher,
    updateLectureTeacher,
    moveLectureTeacher
} from '../controllers/teacherPortalController.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireTeacher);

router.get('/my-instances', getMyInstances);
router.get('/analytics/summary', getAnalyticsSummary);
router.get('/instances/:id/analytics', getInstanceAnalytics);
router.get('/instances/:id/chapters', getInstanceChapters);

router.post('/chapters', createChapterTeacher);
router.put('/chapters/reorder', reorderChaptersTeacher);
router.put('/chapters/:id', updateChapterTeacher);

router.put('/lectures/:id/move', moveLectureTeacher);
router.put('/lectures/:id', updateLectureTeacher);

export default router;
