export function requireAdmin(req, res, next) {
    if (!req.actor) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.authContext?.viewMode?.active) {
        return res.status(403).json({ message: 'Exit student view mode to access admin routes' });
    }
    
    if (req.actor.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    
    next();
}