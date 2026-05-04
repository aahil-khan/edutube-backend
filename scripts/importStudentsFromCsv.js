import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import prisma from '../src/config/db.js';

const csvPathArg = process.argv[2] || 'dump/students.csv';
const passwordArg = process.argv[3] || '123456';
const outputDirArg = process.argv[4] || 'dump';

const chunk = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

function normalizeWhitespace(value = '') {
    return value.replace(/\s+/g, ' ').trim();
}

function parseCsvRow(rawLine = '') {
    const line = rawLine.trim();
    if (!line) return null;

    const withoutBom = line.replace(/^\uFEFF/, '');
    const parts = withoutBom.split(',');
    if (parts.length < 2) return null;

    const fullName = normalizeWhitespace(parts.slice(0, -1).join(','));
    const rollNumber = normalizeWhitespace(parts[parts.length - 1]);
    return { fullName, rollNumber };
}

function normalizeRollNumber(rollNumber = '') {
    return rollNumber.replace(/\s+/g, '');
}

function buildStudentEmail(rollNumber = '') {
    return `${rollNumber}@thapar.edu`.toLowerCase();
}

function isValidRollNumber(rollNumber = '') {
    return /^[0-9]+$/.test(rollNumber);
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

    const seenEmails = new Set();
    const cleanedRows = [];

    for (const rawLine of lines) {
        totalRows += 1;
        const parsed = parseCsvRow(rawLine);
        if (!parsed) {
            invalidRows += 1;
            continue;
        }

        const roll = normalizeRollNumber(parsed.rollNumber);
        if (roll.toLowerCase() === 'roll number') {
            skippedHeaderRows += 1;
            continue;
        }

        if (!isValidRollNumber(roll)) {
            invalidRows += 1;
            continue;
        }

        const email = buildStudentEmail(roll);
        if (seenEmails.has(email)) {
            duplicateRowsInFile += 1;
            continue;
        }

        seenEmails.add(email);
        cleanedRows.push({
            fullName: parsed.fullName || roll,
            rollNumber: roll,
            email
        });
        uniqueRows += 1;
    }

    const cleanedCsvPath = path.join(resolvedOutputDir, 'students.cleaned.csv');
    const cleanedCsvLines = ['FULL NAME,ROLL NUMBER,EMAIL'];
    for (const row of cleanedRows) {
        cleanedCsvLines.push(
            `${escapeCsvField(row.fullName)},${escapeCsvField(row.rollNumber)},${escapeCsvField(row.email)}`
        );
    }
    fs.writeFileSync(cleanedCsvPath, `${cleanedCsvLines.join('\n')}\n`, 'utf8');

    const existingEmails = new Set();
    for (const emailBatch of chunk(cleanedRows.map((row) => row.email), 1000)) {
        const users = await prisma.user.findMany({
            where: { email: { in: emailBatch } },
            select: { email: true }
        });
        for (const user of users) {
            existingEmails.add(user.email.toLowerCase());
        }
    }

    const toCreate = cleanedRows.filter((row) => !existingEmails.has(row.email));
    skippedExistingUsers = cleanedRows.length - toCreate.length;

    const passwordHash = await bcrypt.hash(passwordArg, 10);
    const createdEmailSet = new Set(toCreate.map((row) => row.email));

    for (const createBatch of chunk(toCreate, 1000)) {
        if (createBatch.length === 0) continue;
        await prisma.user.createMany({
            data: createBatch.map((row) => ({
                name: row.fullName,
                email: row.email,
                password_hash: passwordHash,
                role: 'student'
            })),
            skipDuplicates: true
        });
        createdUsers += createBatch.length;
    }

    const restoreRows = [];
    for (const emailBatch of chunk([...createdEmailSet], 1000)) {
        if (emailBatch.length === 0) continue;
        const users = await prisma.user.findMany({
            where: { email: { in: emailBatch } },
            select: {
                id: true,
                name: true,
                email: true,
                password_hash: true,
                role: true,
                created_at: true
            }
        });
        restoreRows.push(...users);
    }
    restoreRows.sort((a, b) => a.id - b.id);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const restoreDumpPath = path.join(resolvedOutputDir, `students.restore.${timestamp}.csv`);
    const restoreLines = ['id,name,email,password_hash,role,user_created_at'];
    for (const row of restoreRows) {
        restoreLines.push([
            row.id,
            escapeCsvField(row.name),
            escapeCsvField(row.email),
            escapeCsvField(row.password_hash),
            row.role,
            row.created_at.toISOString()
        ].join(','));
    }
    fs.writeFileSync(restoreDumpPath, `${restoreLines.join('\n')}\n`, 'utf8');

    console.log('Student import completed.');
    console.log(`total_rows=${totalRows}`);
    console.log(`skipped_header_rows=${skippedHeaderRows}`);
    console.log(`unique_valid_rows=${uniqueRows}`);
    console.log(`invalid_rows=${invalidRows}`);
    console.log(`duplicate_rows_in_file=${duplicateRowsInFile}`);
    console.log(`skipped_existing_users=${skippedExistingUsers}`);
    console.log(`created_users=${createdUsers}`);
    console.log(`restore_rows=${restoreRows.length}`);
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

