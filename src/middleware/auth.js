import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const ACCESS_SECRET_KEY = process.env.ACCESS_SECRET_KEY;

//Authentication
export function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "token not found" });

    jwt.verify(token, ACCESS_SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "token expired" });
        req.user = user;
        next();
    });
}
