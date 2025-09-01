import prisma from '../config/db.js';

export const getCoursesByTeacher = async (req, res) => {
    const teacherId = parseInt(req.params.id);
  
    if (isNaN(teacherId)) {
        return res.status(400).json({ message: 'Invalid teacher ID' });
    }
  
    try {
        const teacher = await prisma.teacher.findUnique({
            where: { id: teacherId },
            include: {
                course_instances: {
                    include: {
                        course_template: true,
                        chapters: {
                            include: {
                                lectures: true
                            }
                        },
                        _count: {
                            select: {
                                chapters: true,
                                enrollments: true
                            }
                        }
                    }
                },
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        if (teacher.course_instances.length === 0) {
            return res.status(404).json({ message: 'No course instances found for this teacher' });
        }

        res.json({
            teacher_info: {
                id: teacher.id,
                name: teacher.user.name,
                email: teacher.user.email
            },
            course_instances: teacher.course_instances
        });
    } catch (error) {
        console.error('Error fetching course instances:', error);
        res.status(500).send('Server error');
    }
};

// Get all available courses for browsing
export const getAllCoursesForBrowsing = async (req, res) => {
    try {
        const courseInstances = await prisma.courseInstance.findMany({
            include: {
                course_template: {
                    select: {
                        name: true,
                        course_code: true,
                        description: true
                    }
                },
                teacher: {
                    include: {
                        user: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        chapters: true,
                        enrollments: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Transform the data for frontend consumption
        const courses = courseInstances.map(instance => ({
            id: instance.id,
            course_name: instance.course_template.name,
            course_code: instance.course_template.course_code,
            description: instance.course_template.description,
            teacher_id: instance.teacher.id,
            teacher_name: instance.teacher.user.name,
            chapter_count: instance._count.chapters,
            enrollment_count: instance._count.enrollments,
            created_at: instance.created_at
        }));

        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses for browsing:', error);
        res.status(500).send('Server error');
    }
};
