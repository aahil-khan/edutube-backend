import bcrypt from 'bcrypt';
import prisma from '../src/config/db.js';

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');

        // Create sample users
        const hashedPassword = await bcrypt.hash('password123', 10);
        
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

        // Create courses
        const course1 = await prisma.course.create({
            data: {
                name: 'Introduction to Programming',
                description: 'Learn the basics of programming with JavaScript'
            }
        });

        const course2 = await prisma.course.create({
            data: {
                name: 'Web Development',
                description: 'Full stack web development with React and Node.js'
            }
        });

        console.log('✅ Courses created successfully');

        // Create teachers (linking users to courses)
        const teacher1 = await prisma.teacher.create({
            data: {
                user_id: teacherUser1.id,
                course_id: course1.id
            }
        });

        const teacher2 = await prisma.teacher.create({
            data: {
                user_id: teacherUser2.id,
                course_id: course2.id
            }
        });

        console.log('✅ Teachers created successfully');

        // Create sample lectures
        const lecture1 = await prisma.lecture.create({
            data: {
                teacher_id: teacher1.id,
                course_id: course1.id,
                chapter_name: 'Getting Started',
                chapter_number: 1,
                lecture_number: 1,
                title: 'Introduction to Variables',
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            }
        });

        const lecture2 = await prisma.lecture.create({
            data: {
                teacher_id: teacher1.id,
                course_id: course1.id,
                chapter_name: 'Getting Started',
                chapter_number: 1,
                lecture_number: 2,
                title: 'Functions and Methods',
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            }
        });

        console.log('✅ Lectures created successfully');

        // Create enrollments
        await prisma.enrollment.create({
            data: {
                student_id: student1.id,
                teacher_id: teacher1.id
            }
        });

        await prisma.enrollment.create({
            data: {
                student_id: student2.id,
                teacher_id: teacher1.id
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

        console.log('✅ Watch history created successfully');

        console.log('🎉 Database seeding completed!');
        console.log('\n📊 Summary:');
        console.log(`👥 Users: ${await prisma.user.count()}`);
        console.log(`📚 Courses: ${await prisma.course.count()}`);
        console.log(`👨‍🏫 Teachers: ${await prisma.teacher.count()}`);
        console.log(`📖 Lectures: ${await prisma.lecture.count()}`);
        console.log(`✍️ Enrollments: ${await prisma.enrollment.count()}`);
        console.log(`📺 Watch History: ${await prisma.watchHistory.count()}`);

        console.log('\n🔑 Test Credentials:');
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
