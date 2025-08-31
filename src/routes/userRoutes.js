import express from 'express';
import { 
    getStudentDetails, 
    getStudentEnrolledCourses, 
    getUserData, 
    changePassword, 
    getDashboard 
} from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/student_details/:id', getStudentDetails);
router.get('/student_enrolled_courses/:id', getStudentEnrolledCourses);
router.get('/get-user-data', authenticateToken, getUserData);
router.post('/change-password', authenticateToken, changePassword);
router.get('/dashboard', authenticateToken, getDashboard);

export default router;
