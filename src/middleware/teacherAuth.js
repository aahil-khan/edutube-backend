import prisma from '../config/db.js';

/**
 * After authenticateToken: require User.role === 'teacher' and a Teacher row.
 * Sets req.teacher = { id, user_id, ... } for ownership checks in controllers.
 */
export async function requireTeacher(req, res, next) {
    if (!req.actor) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.authContext?.viewMode?.active) {
        return res.status(403).json({ message: 'Exit student view mode to access teacher routes' });
    }

    if (req.actor.role !== 'teacher') {
        return res.status(403).json({ message: 'Teacher access required' });
    }

    try {
        const teacher = await prisma.teacher.findUnique({
            where: { user_id: req.actor.id }
        });

        if (!teacher) {
            return res.status(403).json({ message: 'Teacher profile not found for this account' });
        }

        req.teacher = teacher;
        next();
    } catch (e) {
        console.error('requireTeacher error:', e);
        return res.status(500).json({ message: 'Server error' });
    }
}
