import bcrypt from 'bcrypt';
import prisma from '../src/config/db.js';

async function createUser() {
    try {
        const name = process.argv[2];
        const email = process.argv[3];
        const password = process.argv[4];
        const role = process.argv[5] || 'student';

        if (!name || !email || !password) {
            console.log('❌ Usage: node scripts/createUser.js <name> <email> <password> [role]');
            console.log('Example: node scripts/createUser.js "John Doe" "john@example.com" "password123" "student"');
            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password_hash: hashedPassword,
                role: role
            }
        });

        console.log('✅ User created successfully!');
        console.log('📄 User Details:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Created: ${user.created_at}`);

    } catch (error) {
        if (error.code === 'P2002') {
            console.error('❌ Error: Email already exists!');
        } else {
            console.error('❌ Error creating user:', error.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

createUser();
