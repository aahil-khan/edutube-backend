/**
 * Bootstrap: mint a CLI API key without the admin UI (requires DATABASE_URL).
 * Usage: node scripts/createCliApiKey.js "Lab PC 1"
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateRawCliKey() {
    return crypto.randomBytes(24).toString('hex');
}

async function main() {
    const name = process.argv[2] || 'CLI bootstrap key';
    let plaintext = null;
    let keyPrefix = null;

    for (let i = 0; i < 10; i++) {
        plaintext = generateRawCliKey();
        keyPrefix = plaintext.slice(0, 8);
        const existing = await prisma.cliApiKey.findUnique({ where: { key_prefix: keyPrefix } });
        if (!existing) break;
    }

    const key_hash = await bcrypt.hash(plaintext, 10);

    const row = await prisma.cliApiKey.create({
        data: {
            name,
            key_prefix: keyPrefix,
            key_hash,
            note: 'Created via scripts/createCliApiKey.js'
        }
    });

    console.log('CLI API key created. Store the api_key securely; it will not be shown again.\n');
    console.log(JSON.stringify({ id: row.id, name: row.name, key_prefix: row.key_prefix, api_key: plaintext }, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
