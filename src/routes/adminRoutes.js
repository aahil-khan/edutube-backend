import express from 'express';
import {
    getDashboardStats,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    getAllTeachers,
    createTeacher,
    getAllCourseTemplates,
    createCourseTemplate,
    updateCourseTemplate,
    deleteCourseTemplate,
    getAllCourseInstances,
    getCourseInstance,
    createCourseInstance,
    updateCourseInstance,
    deleteCourseInstance,
    getCourseInstanceChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    getChaptersForDropdown,
    getCourseTemplatesForDropdown,
    getCourseInstancesForDropdown,
    getInstanceLectures,
    createLecture,
    updateLecture,
    deleteLecture,
    getTeachersForDropdown,
    getStudentsForDropdown,
    addLectureTags,
    removeLectureTag,
    getLectureTags,
    searchLecturesByTags,
    getAllUniqueTags,
    updateLectureWithTags
} from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// Apply authentication and admin authorization to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// User Management
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Teacher Management
router.get('/teachers', getAllTeachers);
router.post('/teachers', createTeacher);
router.get('/teachers/dropdown', getTeachersForDropdown);

// Course Template Management
router.get('/course-templates', getAllCourseTemplates);
router.post('/course-templates', createCourseTemplate);
router.put('/course-templates/:id', updateCourseTemplate);
router.delete('/course-templates/:id', deleteCourseTemplate);
router.get('/course-templates/dropdown', getCourseTemplatesForDropdown);

// Course Instance Management  
router.get('/course-instances', getAllCourseInstances);
router.get('/course-instances/:id', getCourseInstance);
router.post('/course-instances', createCourseInstance);
router.put('/course-instances/:id', updateCourseInstance);
router.delete('/course-instances/:id', deleteCourseInstance);
router.get('/course-instances/dropdown', getCourseInstancesForDropdown);

// Chapter Management
router.get('/course-instances/:instanceId/chapters', getCourseInstanceChapters);
router.post('/chapters', createChapter);
router.put('/chapters/:id', updateChapter);
router.delete('/chapters/:id', deleteChapter);
router.get('/chapters/dropdown', getChaptersForDropdown);

// Lecture Management
router.get('/course-instances/:instanceId/lectures', getInstanceLectures);
router.post('/lectures', createLecture);
router.put('/lectures/:id', updateLecture);
router.delete('/lectures/:id', deleteLecture);

// Lecture Tag Management
router.post('/lectures/:id/tags', addLectureTags);
router.delete('/lectures/:id/tags/:tagId', removeLectureTag);
router.get('/lectures/:id/tags', getLectureTags);
router.put('/lectures/:id/with-tags', updateLectureWithTags);

// Tag Search and Management
router.get('/lectures/search/by-tags', searchLecturesByTags);
router.get('/tags/unique', getAllUniqueTags);

// Dropdown helpers
router.get('/students/dropdown', getStudentsForDropdown);

export default router;