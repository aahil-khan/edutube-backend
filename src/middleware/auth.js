import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { redisHelpers } from '../config/redis.js';

dotenv.config();

const ACCESS_SECRET_KEY = process.env.ACCESS_SECRET_KEY;

//Authentication
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "token not found" });

    try {
        const actor = jwt.verify(token, ACCESS_SECRET_KEY);
        const viewMode = await redisHelpers.getViewingMode(actor.id.toString());

        const isStudentMode = viewMode?.type === 'student-account' && viewMode?.targetUserId;
        const effectiveUser = isStudentMode
            ? {
                id: viewMode.targetUserId,
                name: viewMode.targetUserName,
                role: 'student'
            }
            : {
                id: actor.id,
                name: actor.name,
                role: actor.role
            };

        req.actor = {
            id: actor.id,
            name: actor.name,
            role: actor.role
        };

        req.user = effectiveUser;

        req.authContext = {
            actor: req.actor,
            effectiveUser,
            viewMode: isStudentMode
                ? {
                    active: true,
                    type: viewMode.type,
                    targetUserId: viewMode.targetUserId,
                    targetUserName: viewMode.targetUserName,
                    targetUserEmail: viewMode.targetUserEmail,
                    startedAt: viewMode.startedAt
                }
                : {
                    active: false,
                    type: null,
                    targetUserId: null,
                    targetUserName: null,
                    targetUserEmail: null,
                    startedAt: null
                }
        };

        next();
    } catch (err) {
        return res.status(403).json({ message: "token expired" });
    }
}
