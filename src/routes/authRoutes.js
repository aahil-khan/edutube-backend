import express from 'express';
import { login, refreshToken, logout, verifyAuth } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticateToken, logout);
router.get('/verify-auth', authenticateToken, verifyAuth);

export default router;
