import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../config/db.js';

function generateRawCliKey() {
    return crypto.randomBytes(24).toString('hex');
}

export async function mintCliApiKey(req, res) {
    try {
        const { name, note } = req.body;
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ message: 'name is required' });
        }

        let plaintext = null;
        let keyPrefix = null;
        let attempts = 0;
        const saltRounds = 10;

        while (attempts < 10) {
            plaintext = generateRawCliKey();
            keyPrefix = plaintext.slice(0, 8);
            const existing = await prisma.cliApiKey.findUnique({ where: { key_prefix: keyPrefix } });
            if (!existing) break;
            attempts += 1;
        }

        if (attempts >= 10) {
            return res.status(500).json({ message: 'Could not generate unique key prefix' });
        }

        const key_hash = await bcrypt.hash(plaintext, saltRounds);

        const row = await prisma.cliApiKey.create({
            data: {
                name: name.trim(),
                key_prefix: keyPrefix,
                key_hash,
                note: note && typeof note === 'string' ? note.trim() : null,
                created_by_user_id: req.user?.id ?? null
            }
        });

        return res.status(201).json({
            message: 'CLI API key created. Store it securely; it will not be shown again.',
            id: row.id,
            name: row.name,
            key_prefix: row.key_prefix,
            api_key: plaintext
        });
    } catch (err) {
        console.error('mintCliApiKey', err);
        return res.status(500).json({ message: 'Server error' });
    }
}

export async function listCliApiKeys(req, res) {
    try {
        const keys = await prisma.cliApiKey.findMany({
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                name: true,
                key_prefix: true,
                created_at: true,
                revoked_at: true,
                last_used_at: true,
                note: true,
                created_by_user_id: true
            }
        });
        return res.json({ keys });
    } catch (err) {
        console.error('listCliApiKeys', err);
        return res.status(500).json({ message: 'Server error' });
    }
}

export async function revokeCliApiKey(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: 'Invalid id' });
        }

        await prisma.cliApiKey.update({
            where: { id },
            data: { revoked_at: new Date() }
        });

        return res.json({ message: 'CLI API key revoked' });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ message: 'Key not found' });
        }
        console.error('revokeCliApiKey', err);
        return res.status(500).json({ message: 'Server error' });
    }
}
