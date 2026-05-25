const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findUser, updateLastLogin, createSession, validateSession, deleteSession, logAction } = require('../utils/database');

const router = express.Router();
const JWT_SECRET = process.env.MYVPS_JWT_SECRET || require('crypto').randomBytes(64).toString('hex');

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
    }

    const user = findUser(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    updateLastLogin(user.id);
    const session = createSession(user.id);

    const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role, sessionId: session.id },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    logAction(user.id, 'login', 'auth', null, null, req.ip);

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    });

    res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role }
    });
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out.' });
});

// Current user
router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

// Change password
router.post('/change-password', authMiddleware, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = findUser(req.user.username);

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(400).json({ error: 'Current password incorrect.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    const { getDB } = require('../utils/database');
    getDB().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

    logAction(user.id, 'change_password', 'auth', null, null, req.ip);
    res.json({ message: 'Password changed.' });
});

// Auth middleware
function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.userId,
            username: decoded.username,
            role: decoded.role
        };
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

module.exports = { authRouter: router, authMiddleware };
