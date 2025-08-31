import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

const ACCESS_SECRET_KEY = process.env.ACCESS_SECRET_KEY;
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY;

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
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            REFRESH_SECRET_KEY,
            { expiresIn: '7d' }
        );

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            accessToken,
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
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token not found' });
    }

    jwt.verify(refreshToken, REFRESH_SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        const accessToken = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            ACCESS_SECRET_KEY,
            { expiresIn: '15m' }
        );

        res.json({ accessToken });
    });
};

export const logout = (req, res) => {
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    res.json({ message: 'Logout successful' });
};

export const verifyAuth = (req, res) => {
    console.log('Authenticated user:', req.user);
    res.status(200).json({message:"token is valid", role:req.user.role});
};
