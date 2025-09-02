import prisma from '../config/db.js';
import bcrypt from 'bcrypt';
import { 
    getPlaylistIdFromUrl, 
    fetchPlaylistVideos, 
    parseYouTubeDuration, 
    generateYouTubeUrl 
} from '../utils/youtubeHelpers.js';

// Helper function to extract YouTube video ID from URL
const getYouTubeVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// Helper function to get YouTube video duration
const getYouTubeDuration = async (videoUrl) => {
    try {
        const videoId = getYouTubeVideoId(videoUrl);
        if (!videoId) return null;

        // For now, we'll return a default duration since YouTube Data API requires API key
        // In production, you would use YouTube Data API v3:
        // const API_KEY = process.env.YOUTUBE_API_KEY;
        // const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${API_KEY}`);
        
        // For demonstration, let's use a simple approach
        // You can implement proper YouTube API integration later
        console.log(`Would fetch duration for video ID: ${videoId}`);
        
        // Return null for now - duration will be optional
        return null;
    } catch (error) {
        console.error('Error fetching YouTube duration:', error);
        return null;
    }
};

// Dashboard Statistics
export const getDashboardStats = async (req, res) => {
    try {
        const [usersCount, teachersCount, courseInstancesCount, lecturesCount, enrollmentsCount] = await Promise.all([
            prisma.user.count(),
            prisma.teacher.count(),
            prisma.courseInstance.count(),
            prisma.lecture.count(),
            prisma.enrollment.count()
        ]);

        const recentUsers = await prisma.user.findMany({
            take: 3,
            orderBy: { created_at: 'desc' },
            select: { id: true, name: true, email: true, role: true, created_at: true }
        });

        // Get recent course instances instead of courses
        const recentCourseInstances = await prisma.courseInstance.findMany({
            take: 3,
            orderBy: { created_at: 'desc' },
            include: {
                teacher: {
                    include: { 
                        user: { 
                            select: { name: true } 
                        } 
                    }
                },
                course_template: {
                    select: { name: true, course_code: true }
                },
                _count: { 
                    select: { 
                        chapters: true, 
                        enrollments: true 
                    } 
                }
            }
        });

        res.json({
            stats: {
                users: usersCount,
                teachers: teachersCount,
                courseInstances: courseInstancesCount,
                lectures: lecturesCount,
                enrollments: enrollmentsCount
            },
            recentUsers,
            recentCourseInstances
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// User Management
export const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, role, search } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (role && role !== 'all') where.role = role;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    created_at: true,
                    updated_at: true
                }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Use transaction to create user and teacher record if role is teacher
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    password_hash,
                    role
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    created_at: true
                }
            });

            // If role is teacher, automatically create teacher record
            if (role === 'teacher') {
                await tx.teacher.create({
                    data: {
                        user_id: user.id
                    }
                });
            }

            return user;
        });

        res.status(201).json({ message: 'User created successfully', user: result });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                created_at: true,
                updated_at: true,
                teacher: {
                    select: {
                        id: true,
                        created_at: true,
                        _count: {
                            select: { course_instances: true }
                        }
                    }
                },
                _count: {
                    select: { 
                        enrollments: true,
                        watchHistory: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, password } = req.body;

        const updateData = { name, email, role };

        // If password is provided, hash it
        if (password) {
            const saltRounds = 10;
            updateData.password_hash = await bcrypt.hash(password, saltRounds);
        }

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                updated_at: true
            }
        });

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            include: {
                teacher: {
                    include: {
                        course_instances: {
                            include: {
                                chapters: {
                                    include: {
                                        lectures: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete in transaction to maintain referential integrity
        await prisma.$transaction(async (tx) => {
            // If user is a teacher, we need to handle course instances carefully
            if (user.teacher) {
                // Delete all chapters (which will cascade delete lectures and their tags)
                for (const instance of user.teacher.course_instances) {
                    await tx.chapter.deleteMany({
                        where: { course_instance_id: instance.id }
                    });
                }

                // Delete course instances
                await tx.courseInstance.deleteMany({
                    where: { teacher_id: user.teacher.id }
                });
            }

            // Delete the user (this will cascade delete teacher, enrollments, watch history)
            await tx.user.delete({
                where: { id: parseInt(id) }
            });
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        
        // Check for specific Prisma errors
        if (error.code === 'P2003') {
            return res.status(400).json({ 
                message: 'Cannot delete user due to existing dependencies. Please remove related data first.',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Dependency constraint error'
            });
        }
        
        res.status(500).json({ 
            message: 'Server error', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Teacher Management
export const getAllTeachers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (search) {
            where.user = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        const [teachers, total] = await Promise.all([
            prisma.teacher.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
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
                        select: {
                            id: true,
                            course_template: {
                                select: {
                                    name: true,
                                    course_code: true
                                }
                            },
                            _count: {
                                select: { enrollments: true }
                            }
                        }
                    },
                    _count: {
                        select: { course_instances: true }
                    }
                },
                orderBy: { created_at: 'desc' }
            }),
            prisma.teacher.count({ where })
        ]);

        res.json({
            teachers,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createTeacher = async (req, res) => {
    try {
        const { userId } = req.body;

        // Check if user exists and is not already a teacher
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
            include: { teacher: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.teacher) {
            return res.status(400).json({ message: 'User is already a teacher' });
        }

        // Update user role to teacher and create teacher record
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: parseInt(userId) },
                data: { role: 'teacher' }
            });

            await tx.teacher.create({
                data: { user_id: parseInt(userId) }
            });
        });

        const teacher = await prisma.teacher.findUnique({
            where: { user_id: parseInt(userId) },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        res.status(201).json({ message: 'Teacher created successfully', teacher });
    } catch (error) {
        console.error('Create teacher error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ===== COURSE TEMPLATE MANAGEMENT =====

// Get all course templates
export const getAllCourseTemplates = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (search) {
            where.OR = [
                { course_code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [templates, total] = await Promise.all([
            prisma.courseTemplate.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    _count: {
                        select: { course_instances: true }
                    }
                },
                orderBy: { created_at: 'desc' }
            }),
            prisma.courseTemplate.count({ where })
        ]);

        res.json({
            templates,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get course templates error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create course template
export const createCourseTemplate = async (req, res) => {
    try {
        const { course_code, name, description } = req.body;

        if (!course_code || !name) {
            return res.status(400).json({ 
                message: 'Course code and name are required' 
            });
        }

        // Validate course code format (6-10 alphanumeric)
        const codeRegex = /^[A-Za-z0-9]{6,10}$/;
        if (!codeRegex.test(course_code)) {
            return res.status(400).json({ 
                message: 'Course code must be 6-10 alphanumeric characters' 
            });
        }

        const template = await prisma.courseTemplate.create({
            data: {
                course_code: course_code.toUpperCase(),
                name,
                description
            }
        });

        res.status(201).json({ 
            message: 'Course template created successfully', 
            template 
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ 
                message: 'Course code already exists' 
            });
        }
        console.error('Create course template error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update course template
export const updateCourseTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { course_code, name, description } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        
        if (course_code) {
            const codeRegex = /^[A-Za-z0-9]{6,10}$/;
            if (!codeRegex.test(course_code)) {
                return res.status(400).json({ 
                    message: 'Course code must be 6-10 alphanumeric characters' 
                });
            }
            updateData.course_code = course_code.toUpperCase();
        }

        const template = await prisma.courseTemplate.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json({ message: 'Course template updated successfully', template });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ 
                message: 'Course code already exists' 
            });
        }
        console.error('Update course template error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete course template
export const deleteCourseTemplate = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete in transaction to maintain referential integrity
        await prisma.$transaction(async (tx) => {
            // Get all course instances for this template
            const instances = await tx.courseInstance.findMany({
                where: { course_template_id: parseInt(id) },
                include: { chapters: { include: { lectures: true } } }
            });

            // Delete all related data
            for (const instance of instances) {
                for (const chapter of instance.chapters) {
                    for (const lecture of chapter.lectures) {
                        // Delete watch history
                        await tx.watchHistory.deleteMany({
                            where: { lecture_id: lecture.id }
                        });
                        // Delete lecture tags
                        await tx.lectureTag.deleteMany({
                            where: { lecture_id: lecture.id }
                        });
                    }
                    // Delete lectures
                    await tx.lecture.deleteMany({
                        where: { chapter_id: chapter.id }
                    });
                }
                // Delete chapters
                await tx.chapter.deleteMany({
                    where: { course_instance_id: instance.id }
                });
                // Delete enrollments
                await tx.enrollment.deleteMany({
                    where: { course_instance_id: instance.id }
                });
            }

            // Delete course instances
            await tx.courseInstance.deleteMany({
                where: { course_template_id: parseInt(id) }
            });

            // Delete the template
            await tx.courseTemplate.delete({
                where: { id: parseInt(id) }
            });
        });

        res.json({ message: 'Course template deleted successfully' });
    } catch (error) {
        console.error('Delete course template error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ===== COURSE INSTANCE MANAGEMENT =====

// Get all course instances
export const getAllCourseInstances = async (req, res) => {
    try {
        const { page = 1, limit = 10, teacher_id, course_template_id } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (teacher_id && teacher_id !== 'all') {
            where.teacher_id = parseInt(teacher_id);
        }
        if (course_template_id && course_template_id !== 'all') {
            where.course_template_id = parseInt(course_template_id);
        }

        const [instances, total] = await Promise.all([
            prisma.courseInstance.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    course_template: {
                        select: {
                            course_code: true,
                            name: true
                        }
                    },
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
                    _count: {
                        select: {
                            chapters: true,
                            enrollments: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            }),
            prisma.courseInstance.count({ where })
        ]);

        res.json({
            instances,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get course instances error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get single course instance
export const getCourseInstance = async (req, res) => {
    try {
        const { id } = req.params;

        const instance = await prisma.courseInstance.findUnique({
            where: { id: parseInt(id) },
            include: {
                course_template: {
                    select: {
                        course_code: true,
                        name: true,
                        description: true
                    }
                },
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
                _count: {
                    select: {
                        chapters: true,
                        enrollments: true
                    }
                }
            }
        });

        if (!instance) {
            return res.status(404).json({ message: 'Course instance not found' });
        }

        res.json({ instance });
    } catch (error) {
        console.error('Get course instance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create course instance
export const createCourseInstance = async (req, res) => {
    try {
        const { 
            course_template_id, 
            teacher_id, 
            instance_name 
        } = req.body;

        if (!course_template_id || !teacher_id) {
            return res.status(400).json({ 
                message: 'Course template and teacher are required' 
            });
        }

        // Verify course template exists
        const template = await prisma.courseTemplate.findUnique({
            where: { id: parseInt(course_template_id) }
        });

        if (!template) {
            return res.status(404).json({ message: 'Course template not found' });
        }

        // Verify teacher exists
        const teacher = await prisma.teacher.findUnique({
            where: { id: parseInt(teacher_id) }
        });

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const instance = await prisma.courseInstance.create({
            data: {
                course_template_id: parseInt(course_template_id),
                teacher_id: parseInt(teacher_id),
                instance_name,
                is_active: true
            },
            include: {
                course_template: {
                    select: {
                        course_code: true,
                        name: true
                    }
                },
                teacher: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });

        res.status(201).json({ 
            message: 'Course instance created successfully', 
            instance 
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ 
                message: 'Teacher already teaches this course' 
            });
        }
        console.error('Create course instance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update course instance
export const updateCourseInstance = async (req, res) => {
    try {
        const { id } = req.params;
        const { instance_name, is_active } = req.body;

        const updateData = {};
        if (instance_name !== undefined) updateData.instance_name = instance_name;
        if (is_active !== undefined) updateData.is_active = is_active;

        const instance = await prisma.courseInstance.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                course_template: {
                    select: {
                        course_code: true,
                        name: true
                    }
                },
                teacher: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });

        res.json({ message: 'Course instance updated successfully', instance });
    } catch (error) {
        console.error('Update course instance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete course instance
export const deleteCourseInstance = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete in transaction to maintain referential integrity
        await prisma.$transaction(async (tx) => {
            // Get all chapters for this instance
            const chapters = await tx.chapter.findMany({
                where: { course_instance_id: parseInt(id) },
                include: { lectures: true }
            });

            // Delete all related data
            for (const chapter of chapters) {
                for (const lecture of chapter.lectures) {
                    // Delete watch history
                    await tx.watchHistory.deleteMany({
                        where: { lecture_id: lecture.id }
                    });
                    // Delete lecture tags
                    await tx.lectureTag.deleteMany({
                        where: { lecture_id: lecture.id }
                    });
                }
                // Delete lectures
                await tx.lecture.deleteMany({
                    where: { chapter_id: chapter.id }
                });
            }

            // Delete chapters
            await tx.chapter.deleteMany({
                where: { course_instance_id: parseInt(id) }
            });

            // Delete enrollments
            await tx.enrollment.deleteMany({
                where: { course_instance_id: parseInt(id) }
            });

            // Delete the instance
            await tx.courseInstance.delete({
                where: { id: parseInt(id) }
            });
        });

        res.json({ message: 'Course instance deleted successfully' });
    } catch (error) {
        console.error('Delete course instance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ===== CHAPTER MANAGEMENT =====

// Get all chapters for a course instance
export const getCourseInstanceChapters = async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;

        const [chapters, total] = await Promise.all([
            prisma.chapter.findMany({
                where: { course_instance_id: parseInt(instanceId) },
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    _count: {
                        select: { lectures: true }
                    }
                },
                orderBy: { number: 'asc' }
            }),
            prisma.chapter.count({
                where: { course_instance_id: parseInt(instanceId) }
            })
        ]);

        res.json({
            chapters,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get course instance chapters error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create a new chapter
export const createChapter = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            number,  // This is optional - will auto-assign if not provided
            course_instance_id   // Required: links to course instance
        } = req.body;

        // Validate required fields
        if (!name || !course_instance_id) {
            return res.status(400).json({ 
                message: 'Missing required fields: name, course_instance_id' 
            });
        }

        // Verify course instance exists
        const instance = await prisma.courseInstance.findUnique({
            where: { id: parseInt(course_instance_id) }
        });

        if (!instance) {
            return res.status(404).json({ message: 'Course instance not found' });
        }

        // Determine chapter number
        let finalChapterNumber = number;
        
        if (!finalChapterNumber) {
            // Auto-assign the next available chapter number
            const lastChapter = await prisma.chapter.findFirst({
                where: { course_instance_id: parseInt(course_instance_id) },
                orderBy: { number: 'desc' }
            });
            finalChapterNumber = lastChapter ? lastChapter.number + 1 : 1;
        } else {
            // Check if chapter number already exists for this instance
            const existingChapter = await prisma.chapter.findFirst({
                where: {
                    course_instance_id: parseInt(course_instance_id),
                    number: parseInt(number)
                }
            });

            if (existingChapter) {
                return res.status(400).json({ 
                    message: 'Chapter number already exists for this course instance' 
                });
            }
        }

        const chapterData = {
            name,
            description: description || '',
            number: parseInt(finalChapterNumber),
            course_instance_id: parseInt(course_instance_id)
        };

        const chapter = await prisma.chapter.create({
            data: chapterData,
            include: {
                course_instance: {
                    include: {
                        course_template: {
                            select: {
                                course_code: true,
                                name: true
                            }
                        }
                    }
                },
                _count: {
                    select: { lectures: true }
                }
            }
        });

        res.status(201).json({ message: 'Chapter created successfully', chapter });
    } catch (error) {
        console.error('Create chapter error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update a chapter
export const updateChapter = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, number } = req.body;

        // Validate required parameters
        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'Valid chapter ID is required' });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (number !== undefined) updateData.number = parseInt(number);

        // Check if there's actually data to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No data provided for update' });
        }

        const chapter = await prisma.chapter.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                course_instance: {
                    include: {
                        course_template: {
                            select: {
                                course_code: true,
                                name: true
                            }
                        }
                    }
                },
                _count: {
                    select: { lectures: true }
                }
            }
        });

        res.json({ message: 'Chapter updated successfully', chapter });
    } catch (error) {
        console.error('Update chapter error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete a chapter
export const deleteChapter = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete in transaction to maintain referential integrity
        await prisma.$transaction(async (tx) => {
            // Delete watch history for lectures in this chapter
            const lectures = await tx.lecture.findMany({
                where: { chapter_id: parseInt(id) }
            });

            for (const lecture of lectures) {
                await tx.watchHistory.deleteMany({
                    where: { lecture_id: lecture.id }
                });

                // Delete lecture tags
                await tx.lectureTag.deleteMany({
                    where: { lecture_id: lecture.id }
                });
            }

            // Delete lectures in this chapter
            await tx.lecture.deleteMany({
                where: { chapter_id: parseInt(id) }
            });

            // Delete the chapter
            await tx.chapter.delete({
                where: { id: parseInt(id) }
            });
        });

        res.json({ message: 'Chapter deleted successfully' });
    } catch (error) {
        console.error('Delete chapter error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const reorderChapters = async (req, res) => {
    try {
        const { courseInstanceId, chapterOrders } = req.body;

        console.log('Reorder chapters request:', { courseInstanceId, chapterOrders });

        if (!courseInstanceId) {
            console.log('Missing courseInstanceId');
            return res.status(400).json({ message: 'Course instance ID is required' });
        }

        if (!chapterOrders || !Array.isArray(chapterOrders)) {
            console.log('Invalid chapterOrders:', chapterOrders);
            return res.status(400).json({ message: 'Chapter orders array is required' });
        }

        if (chapterOrders.length === 0) {
            console.log('Empty chapterOrders array');
            return res.status(400).json({ message: 'Chapter orders array cannot be empty' });
        }

        // Update chapter numbers in transaction using temporary numbering to avoid conflicts
        await prisma.$transaction(async (tx) => {
            const courseInstanceIdInt = parseInt(courseInstanceId);
            
            // First, set all chapters to temporary negative numbers to avoid conflicts
            for (let i = 0; i < chapterOrders.length; i++) {
                const order = chapterOrders[i];
                if (!order.id || order.number === undefined) {
                    console.log('Invalid order object:', order);
                    throw new Error(`Invalid order object: ${JSON.stringify(order)}`);
                }
                
                await tx.chapter.update({
                    where: { 
                        id: parseInt(order.id),
                        course_instance_id: courseInstanceIdInt
                    },
                    data: { 
                        number: -(i + 1) // Temporary negative number
                    }
                });
            }
            
            // Then, update to the final positive numbers
            for (const order of chapterOrders) {
                await tx.chapter.update({
                    where: { 
                        id: parseInt(order.id),
                        course_instance_id: courseInstanceIdInt
                    },
                    data: { 
                        number: parseInt(order.number) 
                    }
                });
            }
        });

        res.json({ message: 'Chapters reordered successfully' });
    } catch (error) {
        console.error('Reorder chapters error:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get chapters for dropdown (for lecture creation)
export const getChaptersForDropdown = async (req, res) => {
    try {
        const { courseId, instanceId } = req.query;

        if (!courseId && !instanceId) {
            return res.status(400).json({ message: 'Course ID or Instance ID is required' });
        }

        let where = {};
        if (instanceId) {
            where.course_instance_id = parseInt(instanceId);
        } else if (courseId) {
            where.course_id = parseInt(courseId);
        }

        const chapters = await prisma.chapter.findMany({
            where,
            select: {
                id: true,
                name: true,
                number: true
            },
            orderBy: { number: 'asc' }
        });

        res.json(chapters);
    } catch (error) {
        console.error('Get chapters dropdown error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get course templates for dropdown
export const getCourseTemplatesForDropdown = async (req, res) => {
    try {
        const templates = await prisma.courseTemplate.findMany({
            select: {
                id: true,
                course_code: true,
                name: true
            },
            orderBy: { course_code: 'asc' }
        });

        res.json(templates);
    } catch (error) {
        console.error('Get course templates dropdown error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get course instances for dropdown
export const getCourseInstancesForDropdown = async (req, res) => {
    try {
        const { teacher_id } = req.query;
        
        const where = teacher_id ? { teacher_id: parseInt(teacher_id) } : {};

        const instances = await prisma.courseInstance.findMany({
            where,
            include: {
                course_template: {
                    select: {
                        course_code: true,
                        name: true
                    }
                },
                teacher: {
                    include: {
                        user: {
                            select: { name: true }
                        }
                    }
                }
            },
            orderBy: {
                course_template: {
                    course_code: 'asc'
                }
            }
        });

        const formatted = instances.map(instance => ({
            id: instance.id,
            label: `${instance.course_template.course_code} - ${instance.course_template.name} (${instance.teacher.user.name})${instance.instance_name ? ` - ${instance.instance_name}` : ''}`,
            course_code: instance.course_template.course_code,
            teacher_name: instance.teacher.user.name,
            instance_name: instance.instance_name
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Get course instances dropdown error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Lecture Management
export const getInstanceLectures = async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { page = 1, limit = 10, chapterId } = req.query;
        const skip = (page - 1) * limit;

        // Build where clause for course instance lectures
        const where = {
            chapter: {
                course_instance_id: parseInt(instanceId)
            }
        };

        if (chapterId && chapterId !== 'all') {
            where.chapter_id = parseInt(chapterId);
        }

        const [lectures, total] = await Promise.all([
            prisma.lecture.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    chapter: {
                        select: {
                            id: true,
                            name: true,
                            number: true,
                            course_instance: {
                                include: {
                                    course_template: {
                                        select: {
                                            course_code: true,
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    tags: {
                        orderBy: { tag: 'asc' }
                    }
                },
                orderBy: [
                    { chapter: { number: 'asc' } },
                    { lecture_number: 'asc' }
                ]
            }),
            prisma.lecture.count({ where })
        ]);

        res.json({
            lectures,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get instance lectures error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createLecture = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            youtube_url, 
            duration, // This is optional
            chapter_id,
            lecture_number, // This is optional - will auto-assign if not provided
            tags // Array of tag strings
        } = req.body;

        // Validate required fields
        if (!title || !youtube_url || !chapter_id) {
            return res.status(400).json({ 
                message: 'Missing required fields: title, youtube_url, chapter_id' 
            });
        }

        // Verify chapter exists and get its course instance info
        const chapter = await prisma.chapter.findUnique({
            where: { id: parseInt(chapter_id) },
            include: {
                course_instance: {
                    include: {
                        course_template: {
                            select: {
                                course_code: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        // Determine lecture number
        let finalLectureNumber = lecture_number;
        
        if (!finalLectureNumber) {
            // Auto-assign the next available lecture number
            const lastLecture = await prisma.lecture.findFirst({
                where: { chapter_id: parseInt(chapter_id) },
                orderBy: { lecture_number: 'desc' }
            });
            finalLectureNumber = lastLecture ? lastLecture.lecture_number + 1 : 1;
        } else {
            // Check if lecture number already exists in this chapter
            const existingLecture = await prisma.lecture.findFirst({
                where: {
                    chapter_id: parseInt(chapter_id),
                    lecture_number: parseInt(lecture_number)
                }
            });

            if (existingLecture) {
                return res.status(400).json({ 
                    message: 'Lecture number already exists in this chapter' 
                });
            }
        }

        // Try to get duration from YouTube if not provided
        let finalDuration = duration;
        
        if (!finalDuration && (youtube_url.includes('youtube.com') || youtube_url.includes('youtu.be'))) {
            const youtubeDuration = await getYouTubeDuration(youtube_url);
            if (youtubeDuration) {
                finalDuration = youtubeDuration;
            }
        }

        // Convert duration to integer, default to 0 if not available
        const durationInSeconds = finalDuration ? parseInt(finalDuration) : 0;

        // Validate and process tags
        let processedTags = [];
        if (tags && Array.isArray(tags)) {
            processedTags = tags
                .filter(tag => tag && typeof tag === 'string')
                .map(tag => tag.trim().toLowerCase())
                .filter(tag => tag.length > 0)
                .slice(0, 10); // Limit to 10 tags
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create the lecture
            const lecture = await tx.lecture.create({
                data: {
                    title,
                    description: description || '',
                    youtube_url,
                    duration: durationInSeconds,
                    chapter_id: parseInt(chapter_id),
                    lecture_number: parseInt(finalLectureNumber)
                }
            });

            // Create tags if provided
            if (processedTags.length > 0) {
                await tx.lectureTag.createMany({
                    data: processedTags.map(tag => ({
                        lecture_id: lecture.id,
                        tag: tag
                    }))
                });
            }

            // Return lecture with all related data
            return await tx.lecture.findUnique({
                where: { id: lecture.id },
                include: {
                    chapter: {
                        select: {
                            id: true,
                            name: true,
                            number: true,
                            course_instance: {
                                include: {
                                    course_template: {
                                        select: {
                                            course_code: true,
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    tags: true
                }
            });
        });

        res.status(201).json({ 
            message: 'Lecture created successfully', 
            lecture: result,
            note: finalDuration ? 'Duration provided' : 'Duration set to 0 (could not auto-fetch)'
        });
    } catch (error) {
        console.error('Create lecture error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateLecture = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, youtube_url, duration, chapter_id, lecture_number } = req.body;

        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (youtube_url) updateData.youtube_url = youtube_url;
        if (duration !== undefined) updateData.duration = parseInt(duration);
        if (chapter_id) updateData.chapter_id = parseInt(chapter_id);
        if (lecture_number !== undefined) updateData.lecture_number = parseInt(lecture_number);

        const lecture = await prisma.lecture.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                chapter: {
                    select: {
                        id: true,
                        name: true,
                        number: true
                    }
                },
                tags: {
                    orderBy: { tag: 'asc' }
                }
            }
        });

        res.json({ message: 'Lecture updated successfully', lecture });
    } catch (error) {
        console.error('Update lecture error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteLecture = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete in transaction to maintain referential integrity
        await prisma.$transaction(async (tx) => {
            // Delete watch history for this lecture
            await tx.watchHistory.deleteMany({
                where: { lecture_id: parseInt(id) }
            });

            // Delete lecture tags
            await tx.lectureTag.deleteMany({
                where: { lecture_id: parseInt(id) }
            });

            // Delete lecture
            await tx.lecture.delete({
                where: { id: parseInt(id) }
            });
        });

        res.json({ message: 'Lecture deleted successfully' });
    } catch (error) {
        console.error('Delete lecture error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const reorderLectures = async (req, res) => {
    try {
        const { chapterId, lectureOrders } = req.body;

        if (!chapterId || !lectureOrders || !Array.isArray(lectureOrders)) {
            return res.status(400).json({ message: 'Chapter ID and lecture orders array are required' });
        }

        // Update lecture numbers in transaction using temporary numbering to avoid conflicts
        await prisma.$transaction(async (tx) => {
            const chapterIdInt = parseInt(chapterId);
            
            // First, set all lectures to temporary negative numbers to avoid conflicts
            for (let i = 0; i < lectureOrders.length; i++) {
                const order = lectureOrders[i];
                await tx.lecture.update({
                    where: { 
                        id: parseInt(order.id),
                        chapter_id: chapterIdInt
                    },
                    data: { 
                        lecture_number: -(i + 1) // Temporary negative number
                    }
                });
            }
            
            // Then, update to the final positive numbers
            for (const order of lectureOrders) {
                await tx.lecture.update({
                    where: { 
                        id: parseInt(order.id),
                        chapter_id: chapterIdInt
                    },
                    data: { 
                        lecture_number: parseInt(order.lecture_number) 
                    }
                });
            }
        });

        res.json({ message: 'Lectures reordered successfully' });
    } catch (error) {
        console.error('Reorder lectures error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all teachers for dropdown
export const getTeachersForDropdown = async (req, res) => {
    try {
        const teachers = await prisma.teacher.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                user: {
                    name: 'asc'
                }
            }
        });

        const formattedTeachers = teachers.map(teacher => ({
            id: teacher.id,
            name: teacher.user.name,
            email: teacher.user.email,
            user_id: teacher.user.id
        }));

        res.json(formattedTeachers);
    } catch (error) {
        console.error('Get teachers dropdown error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get students for dropdown
export const getStudentsForDropdown = async (req, res) => {
    try {
        const students = await prisma.user.findMany({
            where: { role: 'student' },
            select: {
                id: true,
                name: true,
                email: true
            },
            orderBy: { name: 'asc' }
        });

        res.json(students);
    } catch (error) {
        console.error('Get students dropdown error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ===== LECTURE TAG MANAGEMENT =====

// Add tags to a lecture
export const addLectureTags = async (req, res) => {
    try {
        const { id } = req.params; // lecture id
        const { tags } = req.body; // array of tag strings

        if (!tags || !Array.isArray(tags) || tags.length === 0) {
            return res.status(400).json({ message: 'Tags array is required' });
        }

        // Verify lecture exists
        const lecture = await prisma.lecture.findUnique({
            where: { id: parseInt(id) }
        });

        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        // Create tags (ignore duplicates)
        const tagData = tags.map(tag => ({
            lecture_id: parseInt(id),
            tag: tag.trim().toLowerCase()
        }));

        await prisma.lectureTag.createMany({
            data: tagData,
            skipDuplicates: true
        });

        // Get updated lecture with tags
        const updatedLecture = await prisma.lecture.findUnique({
            where: { id: parseInt(id) },
            include: {
                tags: {
                    orderBy: { tag: 'asc' }
                }
            }
        });

        res.json({ 
            message: 'Tags added successfully', 
            lecture: updatedLecture 
        });
    } catch (error) {
        console.error('Add lecture tags error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Remove tags from a lecture
export const removeLectureTag = async (req, res) => {
    try {
        const { id, tagId } = req.params; // lecture id and tag id

        // Verify the tag belongs to this lecture
        const tag = await prisma.lectureTag.findFirst({
            where: {
                id: parseInt(tagId),
                lecture_id: parseInt(id)
            }
        });

        if (!tag) {
            return res.status(404).json({ message: 'Tag not found for this lecture' });
        }

        await prisma.lectureTag.delete({
            where: { id: parseInt(tagId) }
        });

        res.json({ message: 'Tag removed successfully' });
    } catch (error) {
        console.error('Remove lecture tag error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all tags for a specific lecture
export const getLectureTags = async (req, res) => {
    try {
        const { id } = req.params; // lecture id

        const lecture = await prisma.lecture.findUnique({
            where: { id: parseInt(id) },
            include: {
                tags: {
                    orderBy: { tag: 'asc' }
                }
            }
        });

        if (!lecture) {
            return res.status(404).json({ message: 'Lecture not found' });
        }

        res.json({
            lecture_id: lecture.id,
            title: lecture.title,
            tags: lecture.tags
        });
    } catch (error) {
        console.error('Get lecture tags error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Search lectures by tags
export const searchLecturesByTags = async (req, res) => {
    try {
        const { tags, course_id } = req.query;

        if (!tags) {
            return res.status(400).json({ message: 'Tags parameter is required' });
        }

        const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase());

        let where = {
            tags: {
                some: {
                    tag: {
                        in: tagArray
                    }
                }
            }
        };

        // Filter by course if provided
        if (course_id && course_id !== 'all') {
            where.course_id = parseInt(course_id);
        }

        const lectures = await prisma.lecture.findMany({
            where,
            include: {
                tags: true,
                chapter: {
                    include: {
                        course_instance: {
                            include: {
                                course_template: {
                                    select: {
                                        course_code: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: [
                { chapter_id: 'asc' },
                { lecture_number: 'asc' }
            ]
        });

        res.json({
            searchTags: tagArray,
            total: lectures.length,
            lectures
        });
    } catch (error) {
        console.error('Search lectures by tags error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all unique tags across all lectures
export const getAllUniqueTags = async (req, res) => {
    try {
        const { course_id } = req.query;

        let where = {};
        
        // Filter by course if provided
        if (course_id && course_id !== 'all') {
            where.lecture = {
                course_id: parseInt(course_id)
            };
        }

        const tags = await prisma.lectureTag.findMany({
            where,
            select: {
                tag: true
            },
            distinct: ['tag'],
            orderBy: { tag: 'asc' }
        });

        const uniqueTags = tags.map(t => t.tag);

        res.json({
            total: uniqueTags.length,
            tags: uniqueTags
        });
    } catch (error) {
        console.error('Get unique tags error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update lecture with tags in one request
export const updateLectureWithTags = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, youtube_url, duration, tags } = req.body;

        // Update lecture basic info
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (youtube_url !== undefined) updateData.youtube_url = youtube_url;
        if (duration !== undefined) updateData.duration = duration;

        const lecture = await prisma.lecture.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        // Handle tags if provided
        if (tags && Array.isArray(tags)) {
            // Remove existing tags
            await prisma.lectureTag.deleteMany({
                where: { lecture_id: parseInt(id) }
            });

            // Add new tags
            if (tags.length > 0) {
                const tagData = tags.map(tag => ({
                    lecture_id: parseInt(id),
                    tag: tag.trim().toLowerCase()
                }));

                await prisma.lectureTag.createMany({
                    data: tagData,
                    skipDuplicates: true
                });
            }
        }

        // Get updated lecture with tags
        const updatedLecture = await prisma.lecture.findUnique({
            where: { id: parseInt(id) },
            include: {
                tags: {
                    orderBy: { tag: 'asc' }
                },
                chapter: {
                    include: {
                        course_instance: {
                            include: {
                                course_template: {
                                    select: {
                                        course_code: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        res.json({ 
            message: 'Lecture updated successfully', 
            lecture: updatedLecture 
        });
    } catch (error) {
        console.error('Update lecture with tags error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// YouTube Playlist Import Functions

// Fetch videos from YouTube playlist
export const fetchYouTubePlaylist = async (req, res) => {
    try {
        const { playlistUrl } = req.body;

        if (!playlistUrl) {
            return res.status(400).json({ message: 'Playlist URL is required' });
        }

        const playlistId = getPlaylistIdFromUrl(playlistUrl);
        if (!playlistId) {
            return res.status(400).json({ message: 'Invalid YouTube playlist URL' });
        }

        const result = await fetchPlaylistVideos(playlistId);
        
        if (!result.success) {
            return res.status(400).json({ 
                message: 'Failed to fetch playlist videos',
                error: result.error 
            });
        }

        // Format videos for frontend
        const formattedVideos = result.videos.map((video, index) => {
            const videoId = video.snippet.resourceId?.videoId || video.id.videoId;
            return {
                id: videoId,
                title: video.snippet.title,
                description: video.snippet.description,
                thumbnail: video.snippet.thumbnails?.medium?.url || 
                          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                duration: parseYouTubeDuration(video.contentDetails?.duration),
                youtubeUrl: generateYouTubeUrl(videoId),
                position: video.snippet.position || index,
                selected: true // Default to selected
            };
        });

        res.json({
            success: true,
            videos: formattedVideos,
            totalCount: formattedVideos.length,
            playlistId
        });

    } catch (error) {
        console.error('Fetch playlist error:', error);
        res.status(500).json({ 
            message: 'Server error while fetching playlist',
            error: error.message 
        });
    }
};

// Bulk import videos as lectures
export const bulkImportLectures = async (req, res) => {
    try {
        const { courseInstanceId, lectureData } = req.body;

        if (!courseInstanceId || !lectureData || !Array.isArray(lectureData)) {
            return res.status(400).json({ 
                message: 'Course instance ID and lecture data array are required' 
            });
        }

        // Verify course instance exists
        const courseInstance = await prisma.courseInstance.findUnique({
            where: { id: parseInt(courseInstanceId) },
            include: { chapters: true }
        });

        if (!courseInstance) {
            return res.status(404).json({ message: 'Course instance not found' });
        }

        const results = {
            created: [],
            errors: [],
            chaptersCreated: []
        };

        // Process lectures in order
        for (const lectureInfo of lectureData) {
            try {
                const { 
                    title, 
                    description, 
                    youtubeUrl, 
                    duration, 
                    chapterName, 
                    lectureNumber,
                    chapterNumber 
                } = lectureInfo;

                // Find or create chapter
                let chapter = courseInstance.chapters.find(ch => ch.name === chapterName);
                if (!chapter) {
                    chapter = await prisma.chapter.create({
                        data: {
                            name: chapterName,
                            description: `Chapter containing ${chapterName} lectures`,
                            number: chapterNumber || (courseInstance.chapters.length + results.chaptersCreated.length + 1),
                            course_instance_id: courseInstance.id
                        }
                    });
                    results.chaptersCreated.push(chapter);
                    courseInstance.chapters.push(chapter); // Add to local array for next iterations
                }

                // Create lecture
                const lecture = await prisma.lecture.create({
                    data: {
                        title: title,
                        description: description || '',
                        youtube_url: youtubeUrl,
                        duration: duration || 0,
                        lecture_number: lectureNumber,
                        chapter_id: chapter.id
                    }
                });

                results.created.push({
                    id: lecture.id,
                    title: lecture.title,
                    chapterName: chapter.name,
                    lectureNumber: lecture.lecture_number
                });

            } catch (error) {
                console.error(`Error creating lecture "${lectureInfo.title}":`, error);
                results.errors.push({
                    title: lectureInfo.title,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Successfully imported ${results.created.length} lectures`,
            results: results
        });

    } catch (error) {
        console.error('Bulk import lectures error:', error);
        res.status(500).json({ 
            message: 'Server error during bulk import',
            error: error.message 
        });
    }
};