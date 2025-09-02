import prisma from '../config/db.js';
// import redisClient from '../config/redis.js';

export const enrollCourse = async (req, res) => {
    try {
        const { course_instance_id } = req.body;
        const studentId = req.user.id; // Get from authenticated user
        
        // Verify the course instance exists
        const courseInstance = await prisma.courseInstance.findUnique({
            where: { id: course_instance_id }
        });

        if (!courseInstance) {
            return res.status(404).json({ message: 'Course not found' });
        }
        
        // Check if already enrolled
        const existingEnrollment = await prisma.enrollment.findFirst({
            where: {
                student_id: studentId,
                course_instance_id: course_instance_id
            }
        });

        if (existingEnrollment) {
            return res.status(400).json({ message: 'Already enrolled in this course' });
        }

        await prisma.enrollment.create({
            data: {
                student_id: studentId,
                course_instance_id: course_instance_id
            }
        });

        res.status(201).json({ message: 'Successfully enrolled in course' });
    } catch (error) {
        console.error('Enrollment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const unenrollCourse = async (req, res) => {
    try {
        const { course_instance_id } = req.body;
        const studentId = req.user.id; // Get from authenticated user
        
        console.log('Unenroll request:', { course_instance_id, studentId });
        
        // First check if enrollment exists
        const existingEnrollment = await prisma.enrollment.findFirst({
            where: {
                student_id: studentId,
                course_instance_id: course_instance_id
            }
        });

        if (!existingEnrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        // Delete by ID instead of composite key
        await prisma.enrollment.delete({
            where: {
                id: existingEnrollment.id
            }
        });

        res.status(200).json({ message: 'Successfully unenrolled from course' });
    } catch (error) {
        console.error('Unenrollment error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const checkEnrollment = async (req, res) => {
    try {
        const { course_instance_id } = req.params;
        const studentId = req.user.id; // Get from authenticated user
        
        const enrollment = await prisma.enrollment.findFirst({
            where: {
                student_id: studentId,
                course_instance_id: parseInt(course_instance_id)
            }
        });

        res.status(200).json({ isEnrolled: !!enrollment });
    } catch (error) {
        console.error('Check enrollment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
