import express from 'express';
import { enrollCourse, unenrollCourse, checkEnrollment } from '../controllers/enrollmentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/enroll_course', authenticateToken, enrollCourse);
router.delete('/unenroll_course', authenticateToken, unenrollCourse);
router.get('/check/:course_instance_id', authenticateToken, checkEnrollment);

export default router;
