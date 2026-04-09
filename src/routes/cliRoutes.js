import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateCliApiKey } from '../middleware/cliApiKeyAuth.js';
import {
    cliHealth,
    cliGetTree,
    cliGetCourseInstanceTree,
    cliCreateChapter,
    cliRegisterLecture,
    cliGetLectureByVideo
} from '../controllers/cliController.js';

const router = express.Router();

const perKeyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    // Runs after authenticateCliApiKey; always key by CLI key id (no IP fallback).
    keyGenerator: (req) => `cli:${req.cliKey.id}`
});

router.use(authenticateCliApiKey);
router.use(perKeyLimiter);

router.get('/health', cliHealth);
router.get('/tree', cliGetTree);
router.get('/course-instances/:id/tree', cliGetCourseInstanceTree);
router.post('/chapters', cliCreateChapter);
router.post('/lectures/register', cliRegisterLecture);
router.get('/lectures/by-video/:videoId', cliGetLectureByVideo);

export default router;
