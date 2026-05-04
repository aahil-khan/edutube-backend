import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { redisHelpers } from '../config/redis.js';

const ACCESS_SECRET_KEY = process.env.ACCESS_SECRET_KEY;
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY;
const STUDENT_PREVIEW_EMAIL = 'student@thapar.edu';

export const login = async (req, res) => {
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    const { email, password } = req.body;

    console.log('Email:', email);
    console.log('Password:', password);

    try {
        const user = await prisma.user.findUnique({
            where: { email: email }
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const accessToken = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            ACCESS_SECRET_KEY,
            { expiresIn: '1d' }
        );

        const refreshToken = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            REFRESH_SECRET_KEY,
            { expiresIn: '30d' }
        );

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        // Store user session in Redis
        const sessionData = {
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            loginTime: new Date().toISOString()
        };
        await redisHelpers.setSession(user.id.toString(), sessionData, 86400); // 24 hours

        // Cache user data for quick access
        await redisHelpers.setCache(`user:${user.id}`, {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        }, 3600); // 1 hour

        // Ensure no stale preview mode survives a fresh login.
        await redisHelpers.clearViewingMode(user.id.toString());

        res.json({
            success: true,
            accessToken,
            role: user.role,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const refreshToken = (req, res) => {
    const cookieHeader = req.headers?.cookie || '';
    const parsedRefreshToken =
        req.cookies?.refreshToken ||
        cookieHeader
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('refreshToken='))
            ?.split('=')[1];

    if (!parsedRefreshToken) {
        return res.status(401).json({ message: 'Refresh token not found' });
    }

    jwt.verify(parsedRefreshToken, REFRESH_SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        const accessToken = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            ACCESS_SECRET_KEY,
            { expiresIn: '1d' }
        );

        res.json({ accessToken });
    });
};

export const logout = async (req, res) => {
    // const refreshToken = req.cookies.refreshToken;
    
    // if (refreshToken) {
    //     try {
    //         // Decode token to get user ID
    //         const decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY);
            
    //         // Clear session from Redis
    //         await redisHelpers.deleteSession(decoded.id.toString());
            
    //         // Clear user cache
    //         await redisHelpers.deleteCache(`user:${decoded.id}`);
    //     } catch (error) {
    //         console.error('Error clearing session on logout:', error);
    //     }
    // }
    
    const actorUserId = req.actor?.id || req.user?.id;
    if (actorUserId) {
        await redisHelpers.clearViewingMode(actorUserId.toString());
    }

    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    res.json({ message: 'Logout successful' });
};

export const verifyAuth = (req, res) => {
    const authContext = req.authContext || {
        actor: req.actor,
        effectiveUser: req.user,
        viewMode: { active: false, type: null }
    };

    res.status(200).json({
        message: 'token is valid',
        role: authContext.effectiveUser.role,
        actualRole: authContext.actor.role,
        activeRole: authContext.effectiveUser.role,
        name: authContext.effectiveUser.name,
        actualName: authContext.actor.name,
        id: authContext.effectiveUser.id,
        actorId: authContext.actor.id,
        actor: authContext.actor,
        effectiveUser: authContext.effectiveUser,
        viewMode: authContext.viewMode
    });
};

export const startStudentViewMode = async (req, res) => {
    try {
        const actor = req.actor;

        if (!actor || !['admin', 'teacher'].includes(actor.role)) {
            return res.status(403).json({ message: 'Only admin/teacher can enable student view mode' });
        }

        const targetStudent = await prisma.user.findUnique({
            where: { email: STUDENT_PREVIEW_EMAIL },
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            }
        });

        if (!targetStudent || targetStudent.role !== 'student') {
            return res.status(404).json({ message: 'Configured preview student account not found' });
        }

        const startedAt = new Date().toISOString();
        await redisHelpers.setViewingMode(actor.id.toString(), {
            type: 'student-account',
            targetUserId: targetStudent.id,
            targetUserName: targetStudent.name,
            targetUserEmail: targetStudent.email,
            startedAt
        }, 86400);

        return res.status(200).json({
            message: 'Student view mode enabled',
            role: 'student',
            actualRole: actor.role,
            activeRole: 'student',
            actor,
            effectiveUser: {
                id: targetStudent.id,
                name: targetStudent.name,
                role: 'student'
            },
            viewMode: {
                active: true,
                type: 'student-account',
                targetUserId: targetStudent.id,
                targetUserName: targetStudent.name,
                targetUserEmail: targetStudent.email,
                startedAt
            }
        });
    } catch (error) {
        console.error('Start student view mode error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const stopStudentViewMode = async (req, res) => {
    try {
        const actor = req.actor;
        if (!actor) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        await redisHelpers.clearViewingMode(actor.id.toString());

        return res.status(200).json({
            message: 'Student view mode disabled',
            role: actor.role,
            actualRole: actor.role,
            activeRole: actor.role,
            actor,
            effectiveUser: actor,
            viewMode: {
                active: false,
                type: null,
                targetUserId: null,
                targetUserName: null,
                targetUserEmail: null,
                startedAt: null
            }
        });
    } catch (error) {
        console.error('Stop student view mode error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
