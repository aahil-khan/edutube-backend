import bcrypt from 'bcrypt';
import prisma from '../config/db.js';

/**
 * Validates X-CLI-API-Key: full secret key. Lookup by first 8 chars (key_prefix), then bcrypt.compare.
 */
export async function authenticateCliApiKey(req, res, next) {
    const rawKey = req.headers['x-cli-api-key'] || req.headers['X-CLI-API-Key'];

    if (!rawKey || typeof rawKey !== 'string') {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Missing X-CLI-API-Key header',
                details: {}
            }
        });
    }

    if (rawKey.length < 8) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid API key format',
                details: {}
            }
        });
    }

    const keyPrefix = rawKey.slice(0, 8);

    try {
        const row = await prisma.cliApiKey.findUnique({
            where: { key_prefix: keyPrefix }
        });

        if (!row || row.revoked_at) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid or revoked API key',
                    details: {}
                }
            });
        }

        const match = await bcrypt.compare(rawKey, row.key_hash);
        if (!match) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid API key',
                    details: {}
                }
            });
        }

        req.cliKey = { id: row.id, name: row.name };

        prisma.cliApiKey
            .update({
                where: { id: row.id },
                data: { last_used_at: new Date() }
            })
            .catch((e) => console.error('cliApiKey last_used_at update failed', e));

        next();
    } catch (err) {
        console.error('authenticateCliApiKey', err);
        return res.status(500).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Server error during API key validation',
                details: {}
            }
        });
    }
}
