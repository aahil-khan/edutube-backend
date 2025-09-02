import express from 'express';
import { getCoursesByTeacher, getAllCoursesForBrowsing, getCourseInstanceById } from '../controllers/courseController.js';

const router = express.Router();

router.get('/courses/browse', getAllCoursesForBrowsing);
router.get('/courses/teacher/:id', getCoursesByTeacher);
router.get('/courses/:id', getCourseInstanceById);

export default router;
