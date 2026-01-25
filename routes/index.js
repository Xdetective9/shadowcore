const express = require('express');
const router = express.Router();
const { db } = require('../utils/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

module.exports = function(app, io, db) {
    // Home page
    app.get('/', (req, res) => {
        res.render('index', {
            title: 'Home',
            currentPage: 'home',
            user: req.session.user
        });
    });

    // Features page
    app.get('/features', (req, res) => {
        const plugins = Array.from(global.plugins.values()).filter(p => p.enabled);
        
        res.render('features', {
            title: 'Features',
            currentPage: 'features',
            user: req.session.user,
            plugins: plugins
        });
    });

    // Dashboard
    app.get('/dashboard', isAuthenticated, (req, res) => {
        const userPlugins = Array.from(global.plugins.values())
            .filter(p => p.enabled)
            .map(p => ({
                ...p,
                userConfig: req.session.user.plugins?.[p.id] || {}
            }));
        
        res.render('dashboard', {
            title: 'Dashboard',
            currentPage: 'dashboard',
            user: req.session.user,
            plugins: userPlugins
        });
    });

    // Profile
    app.get('/profile', isAuthenticated, async (req, res) => {
        try {
            const user = await db.query(
                'SELECT username, email, avatar, theme, created_at FROM users WHERE id = $1',
                [req.session.user.id]
            );
            
            res.render('profile', {
                title: 'Profile',
                currentPage: 'profile',
                user: req.session.user,
                userData: user.rows[0]
            });
        } catch (error) {
            res.status(500).render('error', { error });
        }
    });

    // Settings
    app.get('/settings', isAuthenticated, (req, res) => {
        res.render('settings', {
            title: 'Settings',
            currentPage: 'settings',
            user: req.session.user
        });
    });

    // Health check
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date(),
            uptime: process.uptime(),
            version: '3.0.0',
            plugins: global.plugins.size,
            memory: process.memoryUsage()
        });
    });

    // About
    app.get('/about', (req, res) => {
        res.render('about', {
            title: 'About',
            currentPage: 'about'
        });
    });

    // Contact
    app.get('/contact', (req, res) => {
        res.render('contact', {
            title: 'Contact',
            currentPage: 'contact'
        });
    });

    // Documentation
    app.get('/docs', (req, res) => {
        res.render('docs', {
            title: 'Documentation',
            currentPage: 'docs'
        });
    });

    // Plugin marketplace
    app.get('/plugins', (req, res) => {
        const plugins = Array.from(global.plugins.values())
            .filter(p => p.enabled)
            .map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                icon: p.icon,
                version: p.version,
                author: p.author,
                category: p.category,
                rating: 4.5,
                downloads: Math.floor(Math.random() * 1000) + 100
            }));
        
        res.render('plugins/index', {
            title: 'Plugins',
            currentPage: 'plugins',
            user: req.session.user,
            plugins: plugins
        });
    });

    // Individual plugin page
    app.get('/plugins/:pluginId', (req, res) => {
        const pluginId = req.params.pluginId;
        const plugin = global.plugins.get(pluginId);
        
        if (!plugin || !plugin.enabled) {
            return res.status(404).render('error', {
                title: 'Plugin Not Found',
                message: 'The requested plugin does not exist or is disabled.'
            });
        }
        
        res.render('plugins/view', {
            title: plugin.name,
            currentPage: 'plugins',
            user: req.session.user,
            plugin: plugin
        });
    });
};
