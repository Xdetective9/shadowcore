// routes/admin.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Admin middleware
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.redirect('/admin/login');
};

// Admin login
router.get('/login', (req, res) => {
    if (req.session.user?.role === 'admin') {
        return res.redirect('/admin');
    }
    res.render('admin/login', { title: 'Admin Login' });
});

router.post('/login', (req, res) => {
    const { password } = req.body;
    
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.user = {
            id: 'admin',
            name: 'Administrator',
            email: 'admin@shadowcore.app',
            role: 'admin',
            verified: true
        };
        return res.redirect('/admin');
    }
    
    res.render('admin/login', { 
        title: 'Admin Login',
        error: 'Invalid password' 
    });
});

// Admin dashboard
router.get('/', isAdmin, async (req, res) => {
    // Read stats from database
    const db = require('../core/database');
    const database = new db();
    
    const [users, plugins, logs] = await Promise.all([
        database.get('users'),
        database.get('plugins'),
        database.get('logs', {}, 100)
    ]);
    
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        user: req.session.user,
        stats: {
            totalUsers: users.length,
            totalPlugins: plugins.length,
            activePlugins: plugins.filter(p => p.enabled).length,
            todayLogs: logs.filter(l => {
                const logDate = new Date(l.timestamp);
                const today = new Date();
                return logDate.toDateString() === today.toDateString();
            }).length
        },
        recentLogs: logs.slice(0, 10)
    });
});

// Plugin management
router.get('/plugins', isAdmin, async (req, res) => {
    const db = require('../core/database');
    const database = new db();
    const plugins = await database.get('plugins');
    
    res.render('admin/plugins', {
        title: 'Plugin Manager',
        user: req.session.user,
        plugins: plugins
    });
});

// Plugin upload
router.get('/plugins/upload', isAdmin, (req, res) => {
    res.render('admin/upload', {
        title: 'Upload Plugin',
        user: req.session.user
    });
});

router.post('/plugins/upload', isAdmin, async (req, res) => {
    try {
        if (!req.files || !req.files.plugin) {
            return res.json({ success: false, error: 'No plugin file' });
        }
        
        const pluginFile = req.files.plugin;
        
        // Validate file
        if (!pluginFile.name.endsWith('.plugin.js')) {
            return res.json({ success: false, error: 'File must be .plugin.js' });
        }
        
        // Save to plugins directory
        const pluginPath = path.join(__dirname, '../plugins', pluginFile.name);
        await pluginFile.mv(pluginPath);
        
        // Dynamically load the plugin
        delete require.cache[require.resolve(pluginPath)];
        
        // Get plugin info
        const pluginModule = require(pluginPath);
        const pluginId = pluginFile.name.replace('.plugin.js', '');
        
        // Save to database
        const db = require('../core/database');
        const database = new db();
        
        await database.insert('plugins', {
            id: pluginId,
            name: pluginModule.name || pluginId,
            version: pluginModule.version || '1.0.0',
            author: pluginModule.author || 'Unknown',
            enabled: true,
            installedAt: new Date().toISOString(),
            file: pluginFile.name
        });
        
        // Install dependencies if any
        if (pluginModule.dependencies && pluginModule.dependencies.length > 0) {
            // Update package.json
            const packagePath = path.join(__dirname, '../package.json');
            const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
            
            pluginModule.dependencies.forEach(dep => {
                if (!packageData.dependencies[dep]) {
                    packageData.dependencies[dep] = 'latest';
                }
            });
            
            await fs.writeFile(packagePath, JSON.stringify(packageData, null, 2));
        }
        
        res.json({
            success: true,
            message: 'Plugin uploaded successfully',
            plugin: {
                id: pluginId,
                name: pluginModule.name,
                dependencies: pluginModule.dependencies || []
            }
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// User management
router.get('/users', isAdmin, async (req, res) => {
    const db = require('../core/database');
    const database = new db();
    const users = await database.get('users');
    
    res.render('admin/users', {
        title: 'User Management',
        user: req.session.user,
        users: users.map(u => ({ ...u, password: undefined }))
    });
});

// Settings
router.get('/settings', isAdmin, (req, res) => {
    res.render('admin/settings', {
        title: 'System Settings',
        user: req.session.user,
        env: process.env
    });
});

router.post('/settings', isAdmin, async (req, res) => {
    const { key, value } = req.body;
    
    // Update environment variable in .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    
    try {
        envContent = await fs.readFile(envPath, 'utf8');
    } catch (err) {
        envContent = '';
    }
    
    // Update or add the variable
    const lines = envContent.split('\n');
    let found = false;
    
    const newLines = lines.map(line => {
        if (line.startsWith(`${key}=`)) {
            found = true;
            return `${key}=${value}`;
        }
        return line;
    });
    
    if (!found) {
        newLines.push(`${key}=${value}`);
    }
    
    await fs.writeFile(envPath, newLines.join('\n'));
    
    // Update process.env
    process.env[key] = value;
    
    res.json({ success: true, message: 'Settings updated' });
});

// System logs
router.get('/logs', isAdmin, async (req, res) => {
    const db = require('../core/database');
    const database = new db();
    const logs = await database.get('logs', {}, 1000);
    
    res.render('admin/logs', {
        title: 'System Logs',
        user: req.session.user,
        logs: logs.reverse()
    });
});

module.exports = router;
