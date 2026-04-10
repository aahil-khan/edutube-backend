import express from 'express';
import {
	login,
	refreshToken,
	logout,
	verifyAuth,
	startStudentViewMode,
	stopStudentViewMode
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticateToken, logout);
router.get('/verify-auth', authenticateToken, verifyAuth);
router.post('/student-view/start', authenticateToken, startStudentViewMode);
router.post('/student-view/stop', authenticateToken, stopStudentViewMode);

export default router;
