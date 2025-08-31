import prisma from '../config/db.js';
// import redisClient from '../config/redis.js';

export const enrollCourse = async (req, res) => {
    try {
        const { studentId, teacherId } = req.body;
        
        await prisma.enrollment.create({
            data: {
                student_id: studentId,
                teacher_id: teacherId
            }
        });

        // Update Redis cache after enrolling
        // const cacheKey = `user_data_${studentId}`;
        // const updatedUserData = await prisma.user.findUnique({
        //     where: { id: studentId },
        //     select: { name: true, email: true }
        // });
        // 
        // const enrolledCourses = await prisma.enrollment.findMany({
        //     where: { student_id: studentId },
        //     include: {
        //         teacher: {
        //             include: {
        //                 course: true,
        //                 user: true
        //             }
        //         }
        //     }
        // });
        // 
        // const coursesData = enrolledCourses.map(enrollment => ({
        //     teacher_id: enrollment.teacher.id,
        //     teacher_name: enrollment.teacher.user.name,
        //     course_name: enrollment.teacher.course.name
        // }));
        // 
        // const userData = { 
        //     name: updatedUserData.name, 
        //     email: updatedUserData.email, 
        //     enrolled_courses: coursesData 
        // };
        // await redisClient.set(cacheKey, JSON.stringify(userData), { EX: 3600 });

        res.status(200).json({ message: "Student enrolled successfully" });
    } catch (error) {
        console.error('Error enrolling student:', error);
        res.status(500).send("Error: " + error.message);
    }
};

export const unenrollCourse = async (req, res) => {
    try {
        const { studentId, teacherId } = req.body;
        
        await prisma.enrollment.delete({
            where: {
                student_id_teacher_id: {
                    student_id: studentId,
                    teacher_id: teacherId
                }
            }
        });

        // Update Redis cache after unenrolling
        // const cacheKey = `user_data_${studentId}`;
        // const updatedUserData = await prisma.user.findUnique({
        //     where: { id: studentId },
        //     select: { name: true, email: true }
        // });
        // 
        // const enrolledCourses = await prisma.enrollment.findMany({
        //     where: { student_id: studentId },
        //     include: {
        //         teacher: {
        //             include: {
        //                 course: true,
        //                 user: true
        //             }
        //         }
        //     }
        // });
        // 
        // const coursesData = enrolledCourses.map(enrollment => ({
        //     teacher_id: enrollment.teacher.id,
        //     teacher_name: enrollment.teacher.user.name,
        //     course_name: enrollment.teacher.course.name
        // }));
        // 
        // const userData = { 
        //     name: updatedUserData.name, 
        //     email: updatedUserData.email, 
        //     enrolled_courses: coursesData 
        // };
        // await redisClient.set(cacheKey, JSON.stringify(userData), { EX: 3600 });

        res.status(200).json({ message: "Student unenrolled successfully" });
    } catch (error) {
        console.error('Error unenrolling student:', error);
        res.status(500).send("Error: " + error.message);
    }
};
