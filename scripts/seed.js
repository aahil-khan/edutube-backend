import bcrypt from 'bcrypt';
import prisma from '../src/config/db.js';

const PASSWORD = 'password123';

const seedConfig = {
    admin: {
        name: 'System Administrator',
        email: 'admin@edutube.com',
        role: 'admin'
    },
    teacher: {
        name: 'Dr. Alice Johnson',
        email: 'alice@example.com',
        role: 'teacher'
    },
    student: {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'student'
    },
    courseTemplate: {
        course_code: 'CS101A',
        name: 'Introduction to Programming',
        description: 'Learn the fundamentals of programming with JavaScript.'
    },
    courseInstance: {
        instance_name: 'Morning Batch'
    },
    chapters: [
        {
            number: 1,
            name: 'Getting Started',
            description: 'Environment setup and the first lesson.',
            lectures: [
                {
                    lecture_number: 1,
                    title: 'Welcome to EduTube',
                    description: 'A short overview of the course structure.',
                    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    youtube_video_id: 'dQw4w9WgXcQ',
                    duration: 215,
                    tags: ['beginner', 'overview', 'javascript']
                },
                {
                    lecture_number: 2,
                    title: 'Variables and Data Types',
                    description: 'Strings, numbers, booleans, and how to store values.',
                    youtube_url: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
                    youtube_video_id: 'oHg5SJYRHA0',
                    duration: 640,
                    tags: ['variables', 'data-types', 'javascript']
                }
            ]
        },
        {
            number: 2,
            name: 'Control Flow',
            description: 'Conditions and loops.',
            lectures: [
                {
                    lecture_number: 1,
                    title: 'If Statements and Loops',
                    description: 'Branching logic and repeated execution.',
                    youtube_url: 'https://www.youtube.com/watch?v=DLzxrzFCyOs',
                    youtube_video_id: 'DLzxrzFCyOs',
                    duration: 780,
                    tags: ['conditionals', 'loops', 'control-flow']
                }
            ]
        }
    ]
};

async function ensureUser({ name, email, role, password }) {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
        return existingUser;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.user.create({
        data: {
            name,
            email,
            role,
            password_hash: passwordHash
        }
    });
}

async function ensureTeacher(userId) {
    const existingTeacher = await prisma.teacher.findUnique({ where: { user_id: userId } });

    if (existingTeacher) {
        return existingTeacher;
    }

    return prisma.teacher.create({
        data: {
            user_id: userId
        }
    });
}

async function ensureCourseTemplate(courseTemplateData) {
    const existingTemplate = await prisma.courseTemplate.findUnique({
        where: { course_code: courseTemplateData.course_code }
    });

    if (existingTemplate) {
        return existingTemplate;
    }

    return prisma.courseTemplate.create({
        data: courseTemplateData
    });
}

async function ensureCourseInstance(courseTemplateId, teacherId, instanceName) {
    const existingInstance = await prisma.courseInstance.findFirst({
        where: {
            course_template_id: courseTemplateId,
            teacher_id: teacherId
        }
    });

    if (existingInstance) {
        return existingInstance;
    }

    return prisma.courseInstance.create({
        data: {
            course_template_id: courseTemplateId,
            teacher_id: teacherId,
            instance_name: instanceName,
            is_active: true
        }
    });
}

async function ensureChapter(courseInstanceId, chapterData) {
    const existingChapter = await prisma.chapter.findFirst({
        where: {
            course_instance_id: courseInstanceId,
            number: chapterData.number
        }
    });

    if (existingChapter) {
        return existingChapter;
    }

    return prisma.chapter.create({
        data: {
            course_instance_id: courseInstanceId,
            number: chapterData.number,
            name: chapterData.name,
            description: chapterData.description
        }
    });
}

async function ensureLecture(chapterId, lectureData) {
    const existingLecture = await prisma.lecture.findFirst({
        where: {
            chapter_id: chapterId,
            lecture_number: lectureData.lecture_number
        }
    });

    if (existingLecture) {
        return existingLecture;
    }

    return prisma.lecture.create({
        data: {
            chapter_id: chapterId,
            lecture_number: lectureData.lecture_number,
            title: lectureData.title,
            description: lectureData.description,
            youtube_url: lectureData.youtube_url,
            youtube_video_id: lectureData.youtube_video_id,
            duration: lectureData.duration,
            source: 'cli'
        }
    });
}

async function ensureEnrollment(studentId, courseInstanceId) {
    const existingEnrollment = await prisma.enrollment.findFirst({
        where: {
            student_id: studentId,
            course_instance_id: courseInstanceId
        }
    });

    if (existingEnrollment) {
        return existingEnrollment;
    }

    return prisma.enrollment.create({
        data: {
            student_id: studentId,
            course_instance_id: courseInstanceId
        }
    });
}

async function ensureWatchHistory(userId, lectureId, progress, currentTime) {
    const existingHistory = await prisma.watchHistory.findFirst({
        where: {
            user_id: userId,
            lecture_id: lectureId
        }
    });

    if (existingHistory) {
        return existingHistory;
    }

    return prisma.watchHistory.create({
        data: {
            user_id: userId,
            lecture_id: lectureId,
            progress,
            current_time: currentTime
        }
    });
}

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');

        const admin = await ensureUser({ ...seedConfig.admin, password: PASSWORD });
        const teacherUser = await ensureUser({ ...seedConfig.teacher, password: PASSWORD });
        const studentUser = await ensureUser({ ...seedConfig.student, password: PASSWORD });
        const teacher = await ensureTeacher(teacherUser.id);

        const courseTemplate = await ensureCourseTemplate(seedConfig.courseTemplate);
        const courseInstance = await ensureCourseInstance(
            courseTemplate.id,
            teacher.id,
            seedConfig.courseInstance.instance_name
        );

        const createdLectures = [];

        for (const chapterData of seedConfig.chapters) {
            const chapter = await ensureChapter(courseInstance.id, chapterData);

            for (const lectureData of chapterData.lectures) {
                const lecture = await ensureLecture(chapter.id, lectureData);
                createdLectures.push(lecture);

                await prisma.lectureTag.createMany({
                    data: lectureData.tags.map((tag) => ({
                        lecture_id: lecture.id,
                        tag
                    })),
                    skipDuplicates: true
                });
            }
        }

        await ensureEnrollment(studentUser.id, courseInstance.id);

        if (createdLectures[0]) {
            await ensureWatchHistory(studentUser.id, createdLectures[0].id, 75.5, 450);
        }

        console.log('✅ Database seeding completed');
        console.log('\n📊 Summary:');
        console.log(`🛡️ Admin user id: ${admin.id}`);
        console.log(`👥 Users: ${await prisma.user.count()}`);
        console.log(`👨‍🏫 Teachers: ${await prisma.teacher.count()}`);
        console.log(`📚 Course templates: ${await prisma.courseTemplate.count()}`);
        console.log(`🧩 Course instances: ${await prisma.courseInstance.count()}`);
        console.log(`📖 Chapters: ${await prisma.chapter.count()}`);
        console.log(`🎬 Lectures: ${await prisma.lecture.count()}`);
        console.log(`🏷️ Lecture tags: ${await prisma.lectureTag.count()}`);
        console.log(`✍️ Enrollments: ${await prisma.enrollment.count()}`);
        console.log(`📺 Watch history: ${await prisma.watchHistory.count()}`);

        console.log('\n🔑 Test credentials:');
        console.log('Admin: admin@edutube.com / password123');
        console.log('Teacher: alice@example.com / password123');
        console.log('Student: john@example.com / password123');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

seedDatabase();