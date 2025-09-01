import express from 'express';
import { getCoursesByTeacher, getAllCoursesForBrowsing } from '../controllers/courseController.js';

const router = express.Router();

router.get('/courses/browse', getAllCoursesForBrowsing);
router.get('/courses/:id', getCoursesByTeacher);

export default router;
