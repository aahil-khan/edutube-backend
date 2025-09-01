import bcrypt from 'bcrypt';
import prisma from '../src/config/db.js';

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');

        // Create sample users
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        // Create admin user
        const admin = await prisma.user.create({
            data: {
                name: 'System Administrator',
                email: 'admin@edutube.com',
                password_hash: hashedPassword,
                role: 'admin'
            }
        });

        // Create students
        const student1 = await prisma.user.create({
            data: {
                name: 'John Doe',
                email: 'john@example.com',
                password_hash: hashedPassword,
                role: 'student'
            }
        });

        const student2 = await prisma.user.create({
            data: {
                name: 'Jane Smith',
                email: 'jane@example.com',
                password_hash: hashedPassword,
                role: 'student'
            }
        });

        // Create teacher users
        const teacherUser1 = await prisma.user.create({
            data: {
                name: 'Dr. Alice Johnson',
                email: 'alice@example.com',
                password_hash: hashedPassword,
                role: 'teacher'
            }
        });

        const teacherUser2 = await prisma.user.create({
            data: {
                name: 'Prof. Bob Wilson',
                email: 'bob@example.com',
                password_hash: hashedPassword,
                role: 'teacher'
            }
        });

        console.log('✅ Users created successfully');

        // Create teacher records
        const teacher1 = await prisma.teacher.create({
            data: {
                user_id: teacherUser1.id
            }
        });

        const teacher2 = await prisma.teacher.create({
            data: {
                user_id: teacherUser2.id
            }
        });

        console.log('✅ Teachers created successfully');

        // Create courses
        const course1 = await prisma.course.create({
            data: {
                name: 'Introduction to Programming',
                description: 'Learn the basics of programming with JavaScript',
                teacher_id: teacher1.id
            }
        });

        const course2 = await prisma.course.create({
            data: {
                name: 'Web Development Fundamentals',
                description: 'Full stack web development with React and Node.js',
                teacher_id: teacher1.id
            }
        });

        const course3 = await prisma.course.create({
            data: {
                name: 'Advanced JavaScript',
                description: 'Deep dive into modern JavaScript concepts',
                teacher_id: teacher2.id
            }
        });

        console.log('✅ Courses created successfully');

        // Create lectures for course 1
        const lecture1 = await prisma.lecture.create({
            data: {
                course_id: course1.id,
                chapter_name: 'Getting Started',
                chapter_number: 1,
                lecture_number: 1,
                title: 'Introduction to Variables',
                description: 'Learn about variables and data types',
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                duration: '25:30'
            }
        });

        const lecture2 = await prisma.lecture.create({
            data: {
                course_id: course1.id,
                chapter_name: 'Getting Started',
                chapter_number: 1,
                lecture_number: 2,
                title: 'Functions and Methods',
                description: 'Understanding functions in JavaScript',
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                duration: '32:15'
            }
        });

        const lecture3 = await prisma.lecture.create({
            data: {
                course_id: course1.id,
                chapter_name: 'Control Structures',
                chapter_number: 2,
                lecture_number: 1,
                title: 'If Statements and Loops',
                description: 'Learn about conditional statements and loops',
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                duration: '28:45'
            }
        });

        // Create lectures for course 2
        const lecture4 = await prisma.lecture.create({
            data: {
                course_id: course2.id,
                chapter_name: 'Frontend Basics',
                chapter_number: 1,
                lecture_number: 1,
                title: 'HTML Structure',
                description: 'Building web pages with HTML',
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                duration: '35:20'
            }
        });

        const lecture5 = await prisma.lecture.create({
            data: {
                course_id: course3.id,
                chapter_name: 'ES6 Features',
                chapter_number: 1,
                lecture_number: 1,
                title: 'Arrow Functions and Destructuring',
                description: 'Modern JavaScript syntax',
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                duration: '42:10'
            }
        });

        console.log('✅ Lectures created successfully');

        // Create sample lecture tags
        const lectureTags = [
            { lecture_id: lecture1.id, tag: 'beginner' },
            { lecture_id: lecture1.id, tag: 'variables' },
            { lecture_id: lecture1.id, tag: 'javascript' },
            { lecture_id: lecture1.id, tag: 'fundamentals' },
            
            { lecture_id: lecture2.id, tag: 'functions' },
            { lecture_id: lecture2.id, tag: 'javascript' },
            { lecture_id: lecture2.id, tag: 'programming' },
            { lecture_id: lecture2.id, tag: 'beginner' },
            
            { lecture_id: lecture3.id, tag: 'control-flow' },
            { lecture_id: lecture3.id, tag: 'loops' },
            { lecture_id: lecture3.id, tag: 'conditionals' },
            { lecture_id: lecture3.id, tag: 'javascript' },
            
            { lecture_id: lecture4.id, tag: 'html' },
            { lecture_id: lecture4.id, tag: 'web-development' },
            { lecture_id: lecture4.id, tag: 'frontend' },
            { lecture_id: lecture4.id, tag: 'beginner' },
            
            { lecture_id: lecture5.id, tag: 'es6' },
            { lecture_id: lecture5.id, tag: 'arrow-functions' },
            { lecture_id: lecture5.id, tag: 'destructuring' },
            { lecture_id: lecture5.id, tag: 'advanced' },
            { lecture_id: lecture5.id, tag: 'javascript' }
        ];

        await prisma.lectureTag.createMany({
            data: lectureTags,
            skipDuplicates: true
        });

        console.log('✅ Lecture tags created successfully');

        // Create enrollments
        await prisma.enrollment.create({
            data: {
                student_id: student1.id,
                course_id: course1.id,
                teacher_id: teacher1.id
            }
        });

        await prisma.enrollment.create({
            data: {
                student_id: student1.id,
                course_id: course2.id,
                teacher_id: teacher1.id
            }
        });

        await prisma.enrollment.create({
            data: {
                student_id: student2.id,
                course_id: course1.id,
                teacher_id: teacher1.id
            }
        });

        await prisma.enrollment.create({
            data: {
                student_id: student2.id,
                course_id: course3.id,
                teacher_id: teacher2.id
            }
        });

        console.log('✅ Enrollments created successfully');

        // Create sample watch history
        await prisma.watchHistory.create({
            data: {
                user_id: student1.id,
                lecture_id: lecture1.id,
                progress: 75.5
            }
        });

        await prisma.watchHistory.create({
            data: {
                user_id: student1.id,
                lecture_id: lecture2.id,
                progress: 45.2
            }
        });

        await prisma.watchHistory.create({
            data: {
                user_id: student2.id,
                lecture_id: lecture1.id,
                progress: 90.0
            }
        });

        console.log('✅ Watch history created successfully');

        console.log('🎉 Database seeding completed!');
        console.log('\n📊 Summary:');
        console.log(`👥 Users: ${await prisma.user.count()}`);
        console.log(`👨‍🏫 Teachers: ${await prisma.teacher.count()}`);
        console.log(`📚 Courses: ${await prisma.course.count()}`);
        console.log(`📖 Lectures: ${await prisma.lecture.count()}`);
        console.log(`🏷️ Lecture Tags: ${await prisma.lectureTag.count()}`);
        console.log(`✍️ Enrollments: ${await prisma.enrollment.count()}`);
        console.log(`📺 Watch History: ${await prisma.watchHistory.count()}`);

        console.log('\n🔑 Test Credentials:');
        console.log('Admin: admin@edutube.com / password123');
        console.log('Student: john@example.com / password123');
        console.log('Student: jane@example.com / password123');
        console.log('Teacher: alice@example.com / password123');
        console.log('Teacher: bob@example.com / password123');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedDatabase();