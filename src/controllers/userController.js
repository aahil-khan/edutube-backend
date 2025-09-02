import bcrypt from 'bcrypt';
import prisma from '../config/db.js';
// import redisClient from '../config/redis.js';

export const getStudentDetails = async (req, res) => {
    const id = parseInt(req.params.id);
    const cacheKey = `student_details_${id}`;

    try {
        // const cachedData = await redisClient.get(cacheKey);
        // if (cachedData) {
        //     return res.json(JSON.parse(cachedData));
        // }

        const user = await prisma.user.findUnique({
            where: { id: id }
        });

        if (!user) {
            return res.status(404).json({ message: 'Student not found' });
        } else {
            const studentData = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };

            // await redisClient.set(cacheKey, JSON.stringify(studentData), { EX: 3600 });
            res.json(studentData);
        }
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).send('Server error');
    }
};

export const getStudentEnrolledCourses = async (req, res) => {
    const id = parseInt(req.params.id);
    const cacheKey = `student_enrolled_courses_${id}`;

    try {
        // const cachedData = await redisClient.get(cacheKey);
        // if (cachedData) {
        //     return res.json(JSON.parse(cachedData));
        // }

        const enrolledCourses = await prisma.enrollment.findMany({
            where: { student_id: id },
            include: {
                course_instance: {
                    include: {
                        course_template: true
                    }
                },
                teacher: {
                    include: {
                        user: true
                    }
                }
            }
        });

        if (enrolledCourses.length === 0) {
            return res.status(404).json({ message: 'No enrolled courses found' });
        } else {
            const coursesData = enrolledCourses.map(enrollment => ({
                course_instance_id: enrollment.course_instance.id,
                teacher_id: enrollment.teacher.id,
                course_name: enrollment.course_instance.course_template.name,
                teacher_name: enrollment.teacher.user.name
            }));

            // await redisClient.set(cacheKey, JSON.stringify(coursesData), { EX: 3600 });
            res.json(coursesData);
        }
    } catch (error) {
        console.error('Error fetching enrolled courses:', error);
        res.status(500).send('Server error');
    }
};

export const getUserData = async (req, res) => {
    const userId = req.user.id;
    const cacheKey = `user_data_${userId}`;

    try {
        // const cachedData = await redisClient.get(cacheKey);
        // if (cachedData) {
        //     return res.json(JSON.parse(cachedData));
        // }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                name: true,
                email: true
            }
        });

        const enrolledCourses = await prisma.enrollment.findMany({
            where: { student_id: userId },
            include: {
                course_instance: {
                    include: {
                        course_template: true
                    }
                },
                teacher: {
                    include: {
                        user: true
                    }
                }
            }
        });

        const coursesData = enrolledCourses.map(enrollment => ({
            teacher_id: enrollment.teacher.id,
            teacher_name: enrollment.teacher.user.name,
            course_name: enrollment.course_instance.course_template.name,
            course_code: enrollment.course_instance.course_template.course_code
        }));

        const userData = { 
            name: user.name, 
            email: user.email, 
            enrolled_courses: coursesData 
        };

        console.log(userData);
        // await redisClient.set(cacheKey, JSON.stringify(userData), { EX: 3600 });
        res.json(userData);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Server error');
    }
};

export const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { password_hash: true }
        });

        const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        
        await prisma.user.update({
            where: { id: userId },
            data: { password_hash: newHash }
        });

        // Update Redis cache after password change
        // const cacheKey = `user_data_${userId}`;
        // const updatedUserData = { password_hash: newHash }; // You may want to fetch the updated user data
        // await redisClient.set(cacheKey, JSON.stringify(updatedUserData), { EX: 3600 });

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).send('Server error');
    }
};

export const getDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        res.json({ message: `Welcome to your dashboard, ${req.user.name}` });
    } catch (error) {
        console.error('Error in dashboard route:', error);
        res.status(500).send('Server error');
    }
};
