// routes/api.js
const express = require('express');
const router = express.Router();

// Public API endpoints
router.get('/status', (req, res) => {
    const Database = require('../core/database');
    const db = new Database();
    
    Promise.all([
        db.get('plugins'),
        db.get('users')
    ]).then(([plugins, users]) => {
        res.json({
            status: 'online',
            plugins: plugins.length,
            users: users.length,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    }).catch(error => {
        res.json({
            status: 'online',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    });
});

// Get system info
router.get('/system', (req, res) => {
    res.json({
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        env: process.env.NODE_ENV
    });
});

// Get all plugins (public)
router.get('/plugins', (req, res) => {
    const Database = require('../core/database');
    const db = new Database();
    
    db.get('plugins').then(plugins => {
        res.json({
            plugins: plugins.map(p => ({
                id: p.id,
                name: p.name,
                version: p.version,
                description: p.description,
                icon: p.icon,
                category: p.category,
                enabled: p.enabled
            }))
        });
    }).catch(error => {
        res.status(500).json({ error: error.message });
    });
});

// User info (requires auth)
router.get('/user', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const Database = require('../core/database');
    const db = new Database();
    
    try {
        const users = await db.get('users', { id: req.session.user.id });
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = users[0];
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                verified: user.verified,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user profile
router.put('/user/profile', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { username, bio } = req.body;
    const Database = require('../core/database');
    const db = new Database();
    
    try {
        await db.update('users', req.session.user.id, {
            username: username,
            bio: bio,
            updatedAt: new Date().toISOString()
        });
        
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change password
router.post('/user/change-password', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { currentPassword, newPassword } = req.body;
    const Auth = require('../core/auth');
    const Database = require('../core/database');
    
    const db = new Database();
    const auth = new Auth(db);
    
    try {
        // Verify current password
        const users = await db.get('users', { id: req.session.user.id });
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const isValid = await auth.verifyPassword(users[0].email, currentPassword);
        
        if (!isValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        // Update password
        await auth.resetPassword(users[0].email, newPassword);
        
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user logs
router.get('/user/logs', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const Database = require('../core/database');
    const db = new Database();
    
    try {
        const logs = await db.get('logs', { userId: req.session.user.id }, 50);
        res.json({ logs: logs || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Music player control
router.post('/music/play', (req, res) => {
    const { url, title, artist } = req.body;
    
    // Broadcast to all connected clients via Socket.IO if available
    if (global.io) {
        global.io.emit('music_play', {
            url: url,
            title: title || 'Unknown',
            artist: artist || 'Unknown',
            startedBy: req.session.user?.username || 'System'
        });
    }
    
    res.json({ success: true, playing: true });
});

router.post('/music/pause', (req, res) => {
    if (global.io) {
        global.io.emit('music_pause');
    }
    
    res.json({ success: true, playing: false });
});

router.post('/music/stop', (req, res) => {
    if (global.io) {
        global.io.emit('music_stop');
    }
    
    res.json({ success: true, playing: false });
});

module.exports = router;
