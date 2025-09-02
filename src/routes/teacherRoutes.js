import express from 'express';
import { getTeacherById, getAllTeachersPublic } from '../controllers/teacherController.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/teachers', getAllTeachersPublic);
router.get('/teachers/:id', getTeacherById);

export default router;
