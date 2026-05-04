import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import prisma from '../src/config/db.js';

const csvPathArg = process.argv[2] || 'dump/teachers.csv';
const passwordArg = process.argv[3] || '123456';
const outputDirArg = process.argv[4] || 'dump';

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

function normalizeWhitespace(value = '') {
    return value.replace(/\s+/g, ' ').trim();
}

function parseCsvRow(rawLine = '') {
    const line = rawLine.trim();
    if (!line) return null;

    const withoutBom = line.replace(/^\uFEFF/, '');
    const parts = withoutBom.split(',');

    if (parts.length === 1) {
        const maybeEmail = normalizeWhitespace(parts[0]).toLowerCase();
        return {
            fullName: buildNameFromEmail(maybeEmail),
            email: maybeEmail
        };
    }

    const fullName = normalizeWhitespace(parts.slice(0, -1).join(','));
    const email = normalizeWhitespace(parts[parts.length - 1]).toLowerCase();
    return { fullName, email };
}

function escapeCsvField(value = '') {
    const v = String(value ?? '');
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
}

async function run() {
    const resolvedCsvPath = path.isAbsolute(csvPathArg)
        ? csvPathArg
        : path.resolve(process.cwd(), csvPathArg);
    const resolvedOutputDir = path.isAbsolute(outputDirArg)
        ? outputDirArg
        : path.resolve(process.cwd(), outputDirArg);

    if (!fs.existsSync(resolvedCsvPath)) {
        console.error(`CSV file not found: ${resolvedCsvPath}`);
        process.exit(1);
    }

    if (!fs.existsSync(resolvedOutputDir)) {
        fs.mkdirSync(resolvedOutputDir, { recursive: true });
    }

    const raw = fs.readFileSync(resolvedCsvPath, 'utf8');
    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    let totalRows = 0;
    let skippedHeaderRows = 0;
    let uniqueRows = 0;
    let invalidRows = 0;
    let duplicateRowsInFile = 0;
    let skippedExistingUsers = 0;
    let createdUsers = 0;
    let createdTeachers = 0;
    let skippedMissingTeacherRow = 0;
    let failedRows = 0;

    const seen = new Set();
    const cleanedRows = [];

    for (const rawLine of lines) {
        totalRows += 1;
        const parsed = parseCsvRow(rawLine);
        if (!parsed) {
            invalidRows += 1;
            continue;
        }

        if (parsed.email === 'email' || parsed.email === 'e-mail') {
            skippedHeaderRows += 1;
            continue;
        }

        if (!isValidEmail(parsed.email)) {
            invalidRows += 1;
            continue;
        }

        if (seen.has(parsed.email)) {
            duplicateRowsInFile += 1;
            continue;
        }

        seen.add(parsed.email);
        cleanedRows.push({
            fullName: parsed.fullName || buildNameFromEmail(parsed.email),
            email: parsed.email
        });
        uniqueRows += 1;
    }

    const cleanedCsvPath = path.join(resolvedOutputDir, 'teachers.cleaned.csv');
    const cleanedCsvLines = ['FULL NAME,EMAIL'];
    for (const row of cleanedRows) {
        cleanedCsvLines.push(`${escapeCsvField(row.fullName)},${escapeCsvField(row.email)}`);
    }
    fs.writeFileSync(cleanedCsvPath, `${cleanedCsvLines.join('\n')}\n`, 'utf8');

    const passwordHash = await bcrypt.hash(passwordArg, 10);
    const createdUsersDump = [];

    for (const row of cleanedRows) {
        try {
            const existingUser = await prisma.user.findUnique({ where: { email: row.email } });

            if (existingUser) {
                skippedExistingUsers += 1;
                continue;
            }

            const createdUser = await prisma.user.create({
                data: {
                    name: row.fullName || buildNameFromEmail(row.email),
                    email: row.email,
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

            createdUsersDump.push({
                id: createdUser.id,
                name: createdUser.name,
                email: createdUser.email,
                password_hash: createdUser.password_hash,
                role: createdUser.role,
                user_created_at: createdUser.created_at.toISOString()
            });
            createdTeachers += 1;
        } catch (error) {
            failedRows += 1;
            console.error(`Failed for ${row.email}: ${error.message}`);
        }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const restoreDumpPath = path.join(resolvedOutputDir, `teachers.restore.${timestamp}.csv`);
    const restoreLines = ['id,name,email,password_hash,role,user_created_at'];
    for (const row of createdUsersDump) {
        restoreLines.push([
            row.id,
            escapeCsvField(row.name),
            escapeCsvField(row.email),
            escapeCsvField(row.password_hash),
            row.role,
            row.user_created_at
        ].join(','));
    }
    fs.writeFileSync(restoreDumpPath, `${restoreLines.join('\n')}\n`, 'utf8');

    console.log('Teacher import completed.');
    console.log(`total_rows=${totalRows}`);
    console.log(`skipped_header_rows=${skippedHeaderRows}`);
    console.log(`unique_valid_rows=${uniqueRows}`);
    console.log(`invalid_rows=${invalidRows}`);
    console.log(`duplicate_rows_in_file=${duplicateRowsInFile}`);
    console.log(`skipped_existing_users=${skippedExistingUsers}`);
    console.log(`created_users=${createdUsers}`);
    console.log(`created_teachers=${createdTeachers}`);
    console.log(`skipped_existing_teacher_links=${skippedMissingTeacherRow}`);
    console.log(`failed_rows=${failedRows}`);
    console.log(`cleaned_csv=${cleanedCsvPath}`);
    console.log(`restore_dump=${restoreDumpPath}`);
}

run()
    .catch((error) => {
        console.error('Import failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
