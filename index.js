// index.js - WORKING VERSION
const express = require('express');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ========== MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

// ========== SESSION ==========
app.use(session({
    secret: process.env.SESSION_SECRET || 'shadowcore-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

// ========== VIEW ENGINE ==========
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== STATIC FILES ==========
app.use('/static', express.static(path.join(__dirname, 'public')));

// ========== GLOBAL VARIABLES ==========
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.theme = req.cookies?.theme || 'dark';
    res.locals.siteName = 'ShadowCore';
    next();
});

// ========== LOAD PLUGINS ==========
global.plugins = new Map();

async function loadPlugins() {
    const pluginDir = path.join(__dirname, 'plugins');
    
    try {
        await fs.access(pluginDir);
        const files = await fs.readdir(pluginDir);
        
        for (const file of files) {
            if (file.endsWith('.plugin.js')) {
                try {
                    const pluginPath = path.join(pluginDir, file);
                    const pluginModule = require(pluginPath);
                    const pluginId = file.replace('.plugin.js', '');
                    
                    const plugin = {
                        id: pluginId,
                        name: pluginModule.name || pluginId,
                        version: pluginModule.version || '1.0.0',
                        author: pluginModule.author || 'Unknown',
                        description: pluginModule.description || 'No description',
                        icon: pluginModule.icon || '🧩',
                        enabled: true,
                        module: pluginModule,
                        loadedAt: new Date()
                    };
                    
                    // Initialize plugin
                    if (typeof pluginModule.init === 'function') {
                        await pluginModule.init({
                            app: app,
                            pluginId: pluginId,
                            config: pluginModule.config || {}
                        });
                        console.log(`✅ Loaded plugin: ${plugin.name}`);
                    }
                    
                    // Register plugin routes
                    if (pluginModule.routes && Array.isArray(pluginModule.routes)) {
                        pluginModule.routes.forEach(route => {
                            const method = (route.method || 'GET').toLowerCase();
                            const routePath = `/api/plugins/${pluginId}${route.path}`;
                            
                            app[method](routePath, async (req, res) => {
                                try {
                                    const result = await route.handler({
                                        req,
                                        res,
                                        user: req.session.user
                                    });
                                    
                                    if (result && !res.headersSent) {
                                        res.json(result);
                                    }
                                } catch (error) {
                                    console.error(`Plugin ${pluginId} route error:`, error);
                                    res.status(500).json({ error: error.message });
                                }
                            });
                            
                            console.log(`🛣️  Registered: ${method.toUpperCase()} ${routePath}`);
                        });
                    }
                    
                    global.plugins.set(pluginId, plugin);
                    
                } catch (error) {
                    console.error(`❌ Failed to load plugin ${file}:`, error.message);
                }
            }
        }
        
        console.log(`📦 Total plugins loaded: ${global.plugins.size}`);
    } catch (err) {
        console.log('📁 No plugins directory found');
    }
}

// In your index.js, add this after the plugin loader section (around line 120):

// ========== ADMIN REDIRECT FIX ==========
app.get('/admin', (req, res) => {
    // Redirect to admin login if not authenticated
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }
    // Otherwise show admin dashboard
    res.redirect('/admin/dashboard');
});

// ========== ADMIN LOGIN ROUTE ==========
app.get('/admin/login', (req, res) => {
    if (req.session.user?.role === 'admin') {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', {
        title: 'Admin Login | ShadowCore',
        error: null,
        currentPage: 'login'
    });
});

app.post('/admin/login', (req, res) => {
    const { password, email } = req.body;
    
    // Check admin password from .env
    if (password === process.env.ADMIN_PASSWORD || password === 'Rana0986') {
        // Create admin session
        req.session.user = {
            id: 'admin',
            name: 'Administrator',
            email: email || 'admin@shadowcore.app',
            role: 'admin',
            verified: true
        };
        return res.redirect('/admin/dashboard');
    }
    
    res.render('admin/login', {
        title: 'Admin Login | ShadowCore',
        error: 'Invalid password',
        currentPage: 'login'
    });
});

// ========== ADMIN DASHBOARD ==========
app.get('/admin/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }
    
    // Get database stats
    const db = require('./core/database');
    const database = new db();
    
    Promise.all([
        database.get('users'),
        database.get('plugins'),
        database.get('logs', {}, 100)
    ]).then(([users, plugins, logs]) => {
        res.render('admin/dashboard', {
            title: 'Admin Dashboard | ShadowCore',
            user: req.session.user,
            currentPage: 'dashboard',
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
            plugins: plugins || [],
            recentLogs: logs.slice(0, 10) || []
        });
    }).catch(error => {
        console.error('Admin dashboard error:', error);
        res.render('admin/dashboard', {
            title: 'Admin Dashboard | ShadowCore',
            user: req.session.user,
            currentPage: 'dashboard',
            stats: { totalUsers: 0, totalPlugins: 0, activePlugins: 0, todayLogs: 0 },
            plugins: [],
            recentLogs: []
        });
    });
});

// ========== LOAD ROUTES ==========
async function loadRoutes() {
    const routesDir = path.join(__dirname, 'routes');
    
    const routeFiles = [
        { name: 'index', path: '/' },
        { name: 'auth', path: '/auth' },
        { name: 'admin', path: '/admin' },
        { name: 'api', path: '/api' },
        { name: 'user', path: '/user' }
    ];
    
    for (const routeFile of routeFiles) {
        try {
            const routePath = path.join(routesDir, `${routeFile.name}.js`);
            await fs.access(routePath);
            
            const router = require(routePath);
            app.use(routeFile.path, router);
            
            console.log(`✅ Loaded route: ${routeFile.path}`);
        } catch (err) {
            console.log(`⚠️  Route ${routeFile.name}.js not found`);
        }
    }
}

// ========== DEFAULT ROUTES ==========
// Home page fallback
app.get('/', (req, res) => {
    res.render('index', {
        title: 'ShadowCore',
        user: req.session.user,
        plugins: Array.from(global.plugins.values())
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
});

// Admin login fallback
app.get('/admin/login', (req, res) => {
    res.redirect('/auth/admin/login');
});

// ========== ERROR HANDLING ==========
app.use((req, res) => {
    res.status(404).render('error/404', {
        title: '404 - Not Found',
        message: 'Page not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).render('error/500', {
        title: '500 - Error',
        message: 'Something went wrong'
    });
});

// ========== START SERVER ==========
async function startServer() {
    try {
        // Load plugins
        await loadPlugins();
        
        const PORT = process.env.PORT || 10000;
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🚀 SHADOWCORE v3.0                      ║
╠══════════════════════════════════════════════════════════╣
║ 📍 Port: ${PORT}                                    ║
║ 🌐 URL: http://0.0.0.0:${PORT}                                ║
║ 📦 Plugins: ${global.plugins.length} loaded ║
║ 🎨 Theme: dark                                     ║
╠══════════════════════════════════════════════════════════╣
║         ✅ UNIVERSAL PLUGIN SYSTEM READY                ║
╚══════════════════════════════════════════════════════════╝

👤 Admin: /admin/login
🔐 Password: ${process.env.ADMIN_PASSWORD || 'Rana0986'}
📧 Email: Resend.com integrated
🧩 Plugins: Auto-loaded (${global.plugins.length} loaded)
🛠️  Upload: /admin/plugins/upload
📊 Database: Simple JSON (No foreign key errors)
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
