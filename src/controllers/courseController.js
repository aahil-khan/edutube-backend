import prisma from '../config/db.js';

export const getCoursesByTeacher = async (req, res) => {
    const teacherId = parseInt(req.params.id);
  
    if (isNaN(teacherId)) {
        return res.status(400).json({ message: 'Invalid teacher ID' });
    }
  
    try {
        const courses = await prisma.teacher.findMany({
            where: { id: teacherId },
            include: {
                course: true,
                lectures: true
            }
        });

        if (courses.length === 0) {
            return res.status(404).json({ message: 'No courses found for this teacher' });
        }

        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).send('Server error');
    }
};
