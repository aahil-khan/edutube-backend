#!/usr/bin/env node

/**
 * Setup Default Admin User
 * Creates a default admin user if one doesn't exist
 */

import bcrypt from 'bcrypt';
import prisma from '../src/config/db.js';

const DEFAULT_ADMIN = {
    name: 'Admin User',
    email: 'admin@gmail.com',
    password: 'aahil',
    role: 'admin'
};

async function setupDefaultAdmin() {
    try {
        console.log('🔐 Setting up default admin user...');

        // Check if admin user already exists
        const existingAdmin = await prisma.user.findUnique({
            where: { email: DEFAULT_ADMIN.email }
        });

        if (existingAdmin) {
            console.log('✅ Admin user already exists!');
            console.log(`   Email: ${existingAdmin.email}`);
            console.log(`   Role: ${existingAdmin.role}`);
            return;
        }

        // Create the admin user
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

        const admin = await prisma.user.create({
            data: {
                name: DEFAULT_ADMIN.name,
                email: DEFAULT_ADMIN.email,
                password_hash: hashedPassword,
                role: DEFAULT_ADMIN.role
            }
        });

        console.log('✅ Default admin user created successfully!');
        console.log('📄 Admin Details:');
        console.log(`   ID: ${admin.id}`);
        console.log(`   Name: ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log('');
        console.log('🔑 Login Credentials:');
        console.log(`   Email: ${DEFAULT_ADMIN.email}`);
        console.log(`   Password: ${DEFAULT_ADMIN.password}`);
        console.log('');
        console.log('⚠️  SECURITY: Please change the default password after first login!');

    } catch (error) {
        console.error('❌ Error setting up admin user:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the setup
setupDefaultAdmin()
    .then(() => {
        console.log('🎉 Admin setup completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Admin setup failed:', error);
        process.exit(1);
    });
