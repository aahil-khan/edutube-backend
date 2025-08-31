import express from 'express';
import { enrollCourse, unenrollCourse } from '../controllers/enrollmentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/enroll_course', authenticateToken, enrollCourse);
router.delete('/unenroll_course', authenticateToken, unenrollCourse);

export default router;
