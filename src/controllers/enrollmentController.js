import prisma from '../config/db.js';
// import redisClient from '../config/redis.js';

export const enrollCourse = async (req, res) => {
    try {
        const { course_instance_id, teacher_id } = req.body;
        const studentId = req.user.id; // Get from authenticated user
        
        // Check if already enrolled
        const existingEnrollment = await prisma.enrollment.findUnique({
            where: {
                student_id_course_instance_id: {
                    student_id: studentId,
                    course_instance_id: course_instance_id
                }
            }
        });

        if (existingEnrollment) {
            return res.status(400).json({ message: 'Already enrolled in this course' });
        }

        await prisma.enrollment.create({
            data: {
                student_id: studentId,
                course_instance_id: course_instance_id,
                teacher_id: teacher_id
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
        
        await prisma.enrollment.delete({
            where: {
                student_id_course_instance_id: {
                    student_id: studentId,
                    course_instance_id: course_instance_id
                }
            }
        });

        res.status(200).json({ message: 'Successfully unenrolled from course' });
    } catch (error) {
        console.error('Unenrollment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
