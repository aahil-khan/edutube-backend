import fs from 'fs';
import path from 'path';
import prisma from '../src/config/db.js';

const csvPathArg = process.argv[2] || 'dump/teacherlist_new.csv';

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toTitleCase(value) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function normalizeTeacherName(rawName) {
    if (!rawName) return '';

    let cleaned = rawName.toUpperCase();

    // Remove anything inside brackets, usually titles like (DR.) or (MS.)
    cleaned = cleaned.replace(/\([^)]*\)/g, ' ');

    // Remove common honorific tokens.
    cleaned = cleaned.replace(/\b(DR|DRS|MR|MRS|MS|MISS|PROF|PROFESSOR)\.?\b/g, ' ');

    // Keep only letters, numbers, spaces and basic separators, then flatten separators.
    cleaned = cleaned.replace(/[^A-Z0-9\s._-]/g, ' ');
    cleaned = cleaned.replace(/[._-]+/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return toTitleCase(cleaned);
}

function parseCsvLine(line) {
    const firstComma = line.indexOf(',');
    if (firstComma === -1) {
        return null;
    }

    const rawName = line.slice(0, firstComma).trim();
    const rawEmail = line.slice(firstComma + 1).trim().toLowerCase();

    return { rawName, rawEmail };
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
        .map((line) => line.trim())
        .filter(Boolean);

    let totalRows = 0;
    let invalidRows = 0;
    let duplicateEmailsInFile = 0;
    let missingUsers = 0;
    let nonTeacherUsers = 0;
    let unchangedNames = 0;
    let updatedNames = 0;
    let failedRows = 0;

    const seenEmails = new Set();

    for (const line of lines) {
        if (line.toUpperCase().startsWith('EMPLOYEENAME,')) {
            continue;
        }

        totalRows += 1;

        const parsed = parseCsvLine(line);
        if (!parsed || !isValidEmail(parsed.rawEmail)) {
            invalidRows += 1;
            continue;
        }

        if (seenEmails.has(parsed.rawEmail)) {
            duplicateEmailsInFile += 1;
            continue;
        }
        seenEmails.add(parsed.rawEmail);

        const normalizedName = normalizeTeacherName(parsed.rawName);
        if (!normalizedName) {
            invalidRows += 1;
            continue;
        }

        try {
            const user = await prisma.user.findUnique({ where: { email: parsed.rawEmail } });

            if (!user) {
                missingUsers += 1;
                continue;
            }

            if (user.role !== 'teacher') {
                nonTeacherUsers += 1;
                continue;
            }

            if (user.name === normalizedName) {
                unchangedNames += 1;
                continue;
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { name: normalizedName }
            });

            updatedNames += 1;
        } catch (error) {
            failedRows += 1;
            console.error(`Failed for ${parsed.rawEmail}: ${error.message}`);
        }
    }

    console.log('Teacher name update completed.');
    console.log(`total_rows=${totalRows}`);
    console.log(`invalid_rows=${invalidRows}`);
    console.log(`duplicate_emails_in_file=${duplicateEmailsInFile}`);
    console.log(`missing_users=${missingUsers}`);
    console.log(`non_teacher_users=${nonTeacherUsers}`);
    console.log(`updated_names=${updatedNames}`);
    console.log(`unchanged_names=${unchangedNames}`);
    console.log(`failed_rows=${failedRows}`);
}

run()
    .catch((error) => {
        console.error('Name update failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
