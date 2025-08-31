import express from 'express';
import { getCoursesByTeacher } from '../controllers/courseController.js';

const router = express.Router();

router.get('/courses/:id', getCoursesByTeacher);

export default router;
