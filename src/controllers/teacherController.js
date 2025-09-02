import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get teacher details with all courses
export const getTeacherById = async (req, res) => {
    try {
        const { id } = req.params;
        const teacherId = parseInt(id);

        if (isNaN(teacherId)) {
            return res.status(400).json({ message: 'Invalid teacher ID' });
        }

        // Get teacher details with user info and all course instances
        const teacher = await prisma.teacher.findUnique({
            where: { id: teacherId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        created_at: true
                    }
                },
                course_instances: {
                    include: {
                        course_template: {
                            select: {
                                id: true,
                                course_code: true,
                                name: true,
                                description: true
                            }
                        },
                        chapters: {
                            include: {
                                lectures: {
                                    select: {
                                        id: true,
                                        title: true,
                                        duration: true
                                    }
                                }
                            }
                        },
                        enrollments: {
                            select: {
                                id: true,
                                student_id: true
                            }
                        },
                        _count: {
                            select: {
                                chapters: true,
                                enrollments: true
                            }
                        }
                    },
                    where: {
                        is_active: true
                    },
                    orderBy: {
                        created_at: 'desc'
                    }
                }
            }
        });

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        // Calculate statistics
        const stats = {
            totalCourses: teacher.course_instances.length,
            totalStudents: teacher.course_instances.reduce((acc, course) => acc + course.enrollments.length, 0),
            totalChapters: teacher.course_instances.reduce((acc, course) => acc + course.chapters.length, 0),
            totalLectures: teacher.course_instances.reduce((acc, course) => 
                acc + course.chapters.reduce((chapAcc, chapter) => chapAcc + chapter.lectures.length, 0), 0
            ),
            totalDuration: teacher.course_instances.reduce((acc, course) => 
                acc + course.chapters.reduce((chapAcc, chapter) => 
                    chapAcc + chapter.lectures.reduce((lecAcc, lecture) => 
                        lecAcc + (lecture.duration || 0), 0
                    ), 0
                ), 0
            )
        };

        // Format courses data
        const courses = teacher.course_instances.map(instance => ({
            id: instance.id,
            courseTemplateId: instance.course_template.id,
            courseName: instance.course_template.name,
            courseCode: instance.course_template.course_code,
            description: instance.course_template.description,
            instanceName: instance.instance_name,
            isActive: instance.is_active,
            createdAt: instance.created_at,
            updatedAt: instance.updated_at,
            chaptersCount: instance._count.chapters,
            enrollmentsCount: instance._count.enrollments,
            lecturesCount: instance.chapters.reduce((acc, chapter) => acc + chapter.lectures.length, 0),
            totalDuration: instance.chapters.reduce((acc, chapter) => 
                acc + chapter.lectures.reduce((lecAcc, lecture) => 
                    lecAcc + (lecture.duration || 0), 0
                ), 0
            )
        }));

        const response = {
            id: teacher.id,
            userId: teacher.user.id,
            name: teacher.user.name,
            email: teacher.user.email,
            joinedAt: teacher.user.created_at,
            stats,
            courses
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching teacher details:', error);
        res.status(500).json({ 
            message: 'Failed to fetch teacher details', 
            error: error.message 
        });
    }
};

// Get all teachers with basic info and stats
export const getAllTeachersPublic = async (req, res) => {
    try {
        const { page = 1, limit = 12, search } = req.query;
        const offset = (page - 1) * limit;

        let whereCondition = {};
        if (search) {
            whereCondition = {
                user: {
                    name: {
                        contains: search,
                        mode: 'insensitive'
                    }
                }
            };
        }

        const [teachers, totalCount] = await Promise.all([
            prisma.teacher.findMany({
                where: whereCondition,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            created_at: true
                        }
                    },
                    _count: {
                        select: {
                            course_instances: {
                                where: { is_active: true }
                            }
                        }
                    }
                },
                orderBy: {
                    user: {
                        name: 'asc'
                    }
                },
                skip: parseInt(offset),
                take: parseInt(limit)
            }),
            prisma.teacher.count({
                where: whereCondition
            })
        ]);

        // Get enrollment counts for each teacher
        const teachersWithStats = await Promise.all(
            teachers.map(async (teacher) => {
                const enrollmentCount = await prisma.enrollment.count({
                    where: {
                        course_instance: {
                            teacher_id: teacher.id
                        }
                    }
                });

                return {
                    id: teacher.id,
                    userId: teacher.user.id,
                    name: teacher.user.name,
                    email: teacher.user.email,
                    joinedAt: teacher.user.created_at,
                    courseCount: teacher._count.course_instances,
                    studentCount: enrollmentCount
                };
            })
        );

        res.json({
            teachers: teachersWithStats,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasMore: offset + teachers.length < totalCount
            }
        });
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ 
            message: 'Failed to fetch teachers', 
            error: error.message 
        });
    }
};
