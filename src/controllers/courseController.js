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
                chapters: {
                    include: {
                        _count: {
                            select: {
                                lectures: true
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
        const courses = courseInstances.map(instance => {
            const totalLectures = instance.chapters.reduce((total, chapter) => 
                total + chapter._count.lectures, 0
            );
            
            return {
                id: instance.id,
                course_name: instance.course_template.name,
                course_code: instance.course_template.course_code,
                description: instance.course_template.description,
                teacher_id: instance.teacher.id,
                teacher_name: instance.teacher.user.name,
                chapter_count: instance._count.chapters,
                lecture_count: totalLectures,
                enrollment_count: instance._count.enrollments,
                created_at: instance.created_at
            };
        });

        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses for browsing:', error);
        res.status(500).send('Server error');
    }
};

// Get single course instance by ID
export const getCourseInstanceById = async (req, res) => {
    const courseInstanceId = parseInt(req.params.id);
  
    if (isNaN(courseInstanceId)) {
        return res.status(400).json({ message: 'Invalid course instance ID' });
    }
  
    try {
        const courseInstance = await prisma.courseInstance.findUnique({
            where: { id: courseInstanceId },
            include: {
                course_template: true,
                teacher: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                },
                chapters: {
                    include: {
                        lectures: {
                            orderBy: {
                                created_at: 'asc'
                            }
                        }
                    },
                    orderBy: {
                        created_at: 'asc'
                    }
                }
            }
        });

        if (!courseInstance) {
            return res.status(404).json({ message: 'Course instance not found' });
        }

        // Transform for frontend - return chapters directly as expected
        const chaptersData = courseInstance.chapters.map(chapter => ({
            id: chapter.id,
            chapter_number: chapter.number,
            chapter_name: chapter.name,
            title: chapter.name,
            description: chapter.description,
            course_name: courseInstance.course_template.name,
            instructor_name: courseInstance.teacher.user.name,
            lectures: chapter.lectures.map(lecture => ({
                id: lecture.id,
                lecture_id: lecture.id,
                lecture_number: lecture.lecture_number,
                lecture_title: lecture.title,
                title: lecture.title,
                description: lecture.description,
                lecture_path: lecture.youtube_url || lecture.video_url || '',
                youtube_url: lecture.youtube_url || lecture.video_url || '',
                video_url: lecture.youtube_url || lecture.video_url || '',
                duration: lecture.duration
            }))
        }));

        res.json(chaptersData);
    } catch (error) {
        console.error('Error fetching course instance:', error);
        res.status(500).send('Server error');
    }
};
