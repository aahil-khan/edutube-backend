import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import prisma from '../src/config/db.js';

const csvPathArg = process.argv[2] || 'dump/teacherlist.csv';
const passwordArg = process.argv[3] || '123456';

function buildNameFromEmail(email) {
    const localPart = email.split('@')[0] || 'teacher';
    const normalized = localPart.replace(/[._-]+/g, ' ').trim();

    if (!normalized) {
        return 'Teacher';
    }

    return normalized
        .split(/\s+/)
        .filter(Boolean)
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
        .join(' ');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function run() {
    const resolvedCsvPath = path.isAbsolute(csvPathArg)
        ? csvPathArg
        : path.resolve(process.cwd(), csvPathArg);

    if (!fs.existsSync(resolvedCsvPath)) {
        console.error(`CSV file not found: ${resolvedCsvPath}`);
        process.exit(1);
    }

    const raw = fs.readFileSync(resolvedCsvPath, 'utf8');
    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line.length > 0);

    let totalRows = 0;
    let uniqueRows = 0;
    let invalidRows = 0;
    let duplicateRowsInFile = 0;
    let skippedExistingUsers = 0;
    let createdUsers = 0;
    let createdTeachers = 0;
    let skippedMissingTeacherRow = 0;
    let failedRows = 0;

    const seen = new Set();
    const uniqueEmails = [];

    for (const line of lines) {
        totalRows += 1;

        if (!isValidEmail(line)) {
            invalidRows += 1;
            continue;
        }

        if (seen.has(line)) {
            duplicateRowsInFile += 1;
            continue;
        }

        seen.add(line);
        uniqueEmails.push(line);
        uniqueRows += 1;
    }

    const passwordHash = await bcrypt.hash(passwordArg, 10);

    for (const email of uniqueEmails) {
        try {
            const existingUser = await prisma.user.findUnique({ where: { email } });

            if (existingUser) {
                skippedExistingUsers += 1;
                continue;
            }

            const createdUser = await prisma.user.create({
                data: {
                    name: buildNameFromEmail(email),
                    email,
                    password_hash: passwordHash,
                    role: 'teacher'
                }
            });

            createdUsers += 1;

            const existingTeacher = await prisma.teacher.findUnique({
                where: { user_id: createdUser.id }
            });

            if (existingTeacher) {
                skippedMissingTeacherRow += 1;
                continue;
            }

            await prisma.teacher.create({
                data: {
                    user_id: createdUser.id
                }
            });

            createdTeachers += 1;
        } catch (error) {
            failedRows += 1;
            console.error(`Failed for ${email}: ${error.message}`);
        }
    }

    console.log('Teacher import completed.');
    console.log(`total_rows=${totalRows}`);
    console.log(`unique_valid_rows=${uniqueRows}`);
    console.log(`invalid_rows=${invalidRows}`);
    console.log(`duplicate_rows_in_file=${duplicateRowsInFile}`);
    console.log(`skipped_existing_users=${skippedExistingUsers}`);
    console.log(`created_users=${createdUsers}`);
    console.log(`created_teachers=${createdTeachers}`);
    console.log(`skipped_existing_teacher_links=${skippedMissingTeacherRow}`);
    console.log(`failed_rows=${failedRows}`);
}

run()
    .catch((error) => {
        console.error('Import failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
