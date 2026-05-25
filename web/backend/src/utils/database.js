/**
 * SQLite database for Web Dashboard user management & audit log
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../../data/myvps.db');

let db;

function initDB() {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            module TEXT,
            target TEXT,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_hash TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            permissions TEXT DEFAULT '*',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME,
            active INTEGER DEFAULT 1
        );
    `);

    // Create default admin if no users
    const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (count.count === 0) {
        const { readConfig } = require('./cli');
        const config = readConfig();
        const defaultPassword = config.admin_password || 'admin';
        const hash = bcrypt.hashSync(defaultPassword, 10);
        db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    }
}

function getDB() {
    return db;
}

function findUser(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function updateLastLogin(userId) {
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
}

function createSession(userId) {
    const id = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt);
    return { id, expiresAt };
}

function validateSession(sessionId) {
    const session = db.prepare(`
        SELECT s.*, u.username, u.role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);
    return session;
}

function deleteSession(sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

function logAction(userId, action, module, target, details, ip) {
    db.prepare(`
        INSERT INTO audit_log (user_id, action, module, target, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, action, module, target, details, ip);
}

function getAuditLog(limit = 100) {
    return db.prepare(`
        SELECT al.*, u.username
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT ?
    `).all(limit);
}

module.exports = {
    initDB,
    getDB,
    findUser,
    updateLastLogin,
    createSession,
    validateSession,
    deleteSession,
    logAction,
    getAuditLog
};
