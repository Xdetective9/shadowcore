// ========== SHADOWCORE v3.0 - UNIVERSAL PLATFORM ==========
// Auto-loads plugins, routes, and dependencies WITHOUT manual changes

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
require('dotenv').config();

class ShadowCore {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.plugins = new Map();
        this.routes = new Map();
        this.middlewares = [];
        this.dependencies = new Set();
        this.theme = 'dark';
        this.io = null;
        
        // Create required directories
        this.dirs = ['plugins', 'uploads', 'public', 'views', 'logs', 'temp'];
    }

    async initialize() {
        console.log('🚀 ShadowCore v3.0 Initializing...');
        
        // Create directories
        await this.createDirectories();
        
        // Load core modules
        await this.loadCore();
        
        // Load all plugins
        await this.loadPlugins();
        
        // Auto-install dependencies
        await this.installDependencies();
        
        // Setup server
        await this.setupServer();
        
        console.log('✅ ShadowCore Ready! All systems operational.');
    }

    async createDirectories() {
        for (const dir of this.dirs) {
            try {
                await fs.mkdir(path.join(__dirname, dir), { recursive: true });
            } catch (err) {
                // Directory exists
            }
        }
    }

    async loadCore() {
        // Load database (simple, no foreign key issues)
        const Database = require('./core/database');
        this.db = new Database();
        await this.db.init();
        
        // Load email service
        const EmailService = require('./core/emailService');
        this.email = new EmailService();
        
        // Load authentication
        const Auth = require('./core/auth');
        this.auth = new Auth(this.db);
        
        // Setup express
        this.setupExpress();
        
        // Load core routes
        this.loadCoreRoutes();
    }

    setupExpress() {
        // Security middleware
        this.app.use(require('helmet')());
        this.app.use(require('cors')());
        this.app.use(require('compression')());
        
        // Body parsing
        this.app.use(require('express').json({ limit: '50mb' }));
        this.app.use(require('express').urlencoded({ extended: true, limit: '50mb' }));
        
        // Session with simple memory store (no DB errors)
        this.app.use(require('express-session')({
            secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
            resave: false,
            saveUninitialized: false,
            cookie: { 
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 
            }
        }));
        
        // File upload
        this.app.use(require('express-fileupload')({
            useTempFiles: true,
            tempFileDir: '/tmp/'
        }));
        
        // View engine
        this.app.set('view engine', 'ejs');
        this.app.set('views', [
            path.join(__dirname, 'views'),
            path.join(__dirname, 'plugins/views') // Plugin views
        ]);
        
        // Static files
        this.app.use('/static', require('express').static(path.join(__dirname, 'public')));
        this.app.use('/plugin-assets', require('express').static(path.join(__dirname, 'plugins/assets')));
        
        // Global variables
        this.app.use((req, res, next) => {
            res.locals.user = req.session.user;
            res.locals.theme = req.cookies?.theme || 'dark';
            res.locals.plugins = Array.from(this.plugins.values());
            res.locals.siteName = 'ShadowCore';
            next();
        });
    }

    async loadPlugins() {
        const pluginDir = path.join(__dirname, 'plugins');
        
        try {
            const files = await fs.readdir(pluginDir);
            
            for (const file of files) {
                if (file.endsWith('.plugin.js')) {
                    await this.loadPlugin(path.join(pluginDir, file));
                }
            }
            
            console.log(`📦 Loaded ${this.plugins.size} plugins`);
        } catch (err) {
            console.log('📁 No plugins directory found, creating...');
        }
    }

    async loadPlugin(filePath) {
        try {
            // Clear require cache to allow hot reload
            delete require.cache[require.resolve(filePath)];
            
            const pluginModule = require(filePath);
            const pluginId = path.basename(filePath, '.plugin.js');
            
            const plugin = {
                id: pluginId,
                name: pluginModule.name || pluginId,
                version: pluginModule.version || '1.0.0',
                author: pluginModule.author || 'Unknown',
                description: pluginModule.description || 'No description',
                icon: pluginModule.icon || '🧩',
                category: pluginModule.category || 'utility',
                enabled: true,
                file: filePath,
                module: pluginModule,
                loadedAt: new Date(),
                // Plugin can define its own dependencies
                dependencies: pluginModule.dependencies || [],
                // Plugin can define required env vars
                env: pluginModule.requiredEnv || []
            };
            
            // Check if plugin is enabled in database
            const dbEnabled = await this.db.getPluginStatus(pluginId);
            if (dbEnabled === false) {
                console.log(`⏸️  Plugin ${plugin.name} is disabled in database`);
                return;
            }
            
            // Initialize plugin
            if (typeof pluginModule.init === 'function') {
                const initResult = await pluginModule.init({
                    app: this.app,
                    db: this.db,
                    email: this.email,
                    auth: this.auth,
                    pluginId: plugin.id,
                    config: pluginModule.config || {}
                });
                
                plugin.initResult = initResult;
                console.log(`✅ Plugin initialized: ${plugin.name} v${plugin.version}`);
            }
            
            // Register plugin routes
            if (pluginModule.routes && Array.isArray(pluginModule.routes)) {
                this.registerPluginRoutes(plugin);
            }
            
            // Register plugin middleware
            if (pluginModule.middleware && Array.isArray(pluginModule.middleware)) {
                this.registerPluginMiddleware(plugin);
            }
            
            // Add plugin dependencies
            if (plugin.dependencies && plugin.dependencies.length > 0) {
                plugin.dependencies.forEach(dep => this.dependencies.add(dep));
            }
            
            // Store plugin
            this.plugins.set(pluginId, plugin);
            
            // Add to database
            await this.db.savePlugin(plugin);
            
        } catch (err) {
            console.error(`❌ Failed to load plugin ${filePath}:`, err.message);
        }
    }

    registerPluginRoutes(plugin) {
        plugin.module.routes.forEach(route => {
            const method = (route.method || 'GET').toLowerCase();
            const path = `/api/plugins/${plugin.id}${route.path}`;
            
            // Add authentication middleware if specified
            const handlers = [];
            
            if (route.auth) {
                handlers.push(this.auth.middleware(route.auth));
            }
            
            handlers.push(async (req, res) => {
                try {
                    const result = await route.handler({
                        req,
                        res,
                        db: this.db,
                        user: req.session.user,
                        plugin: plugin,
                        config: plugin.module.config || {}
                    });
                    
                    if (result && !res.headersSent) {
                        res.json(result);
                    }
                } catch (error) {
                    console.error(`Plugin ${plugin.id} route error:`, error);
                    res.status(500).json({ 
                        error: 'Plugin route error', 
                        message: error.message 
                    });
                }
            });
            
            this.app[method](path, ...handlers);
            console.log(`🛣️  Registered route: ${method.toUpperCase()} ${path}`);
        });
    }

    registerPluginMiddleware(plugin) {
        plugin.module.middleware.forEach(middleware => {
            this.app.use(middleware);
            this.middlewares.push({ plugin: plugin.id, middleware: middleware.name });
        });
    }

    async installDependencies() {
        if (this.dependencies.size === 0) return;
        
        console.log('📦 Installing plugin dependencies...');
        const deps = Array.from(this.dependencies);
        
        // Update package.json
        const packagePath = path.join(__dirname, 'package.json');
        const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        
        deps.forEach(dep => {
            if (!packageData.dependencies[dep]) {
                packageData.dependencies[dep] = 'latest';
            }
        });
        
        await fs.writeFile(packagePath, JSON.stringify(packageData, null, 2));
        console.log('✅ Updated package.json with plugin dependencies');
        
        // Note: Actual npm install should be done manually or via deployment script
        // This prevents permission issues on hosting platforms
    }

    loadCoreRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                version: '3.0.0',
                plugins: this.plugins.size,
                timestamp: new Date()
            });
        });
        
        // Home page
        this.app.get('/', (req, res) => {
            res.render('index', {
                title: 'ShadowCore | Universal Plugin Platform',
                user: req.session.user,
                plugins: Array.from(this.plugins.values())
            });
        });
        
        // Auto-load route files
        this.autoLoadRoutes();
    }

    autoLoadRoutes() {
        const routesDir = path.join(__dirname, 'routes');
        
        // Dynamically require all route files
        ['auth', 'admin', 'api', 'user'].forEach(routeFile => {
            try {
                const routePath = path.join(routesDir, `${routeFile}.js`);
                if (require('fs').existsSync(routePath)) {
                    const router = require(routePath);
                    this.app.use(`/${routeFile === 'index' ? '' : routeFile}`, router);
                    console.log(`🛣️  Loaded route: /${routeFile}`);
                }
            } catch (err) {
                console.log(`⚠️  Route ${routeFile}.js not found or has errors`);
            }
        });
    }

    async setupServer() {
        // Error handling
        this.app.use((req, res) => {
            res.status(404).render('error/404', {
                title: '404 - Not Found',
                message: 'The page you requested does not exist.'
            });
        });
        
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            res.status(500).render('error/500', {
                title: '500 - Server Error',
                message: 'Something went wrong on our end.'
            });
        });
        
        // Start server
        this.app.listen(this.port, () => {
            console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🚀 SHADOWCORE v3.0                      ║
╠══════════════════════════════════════════════════════════╣
║ 📍 Port: ${this.port.toString().padEnd(40)} ║
║ 🌐 URL: http://localhost:${this.port.toString().padEnd(36)} ║
║ 📦 Plugins: ${this.plugins.size.toString().padEnd(38)} ║
║ 🎨 Theme: ${this.theme.padEnd(40)} ║
╠══════════════════════════════════════════════════════════╣
║         ✅ UNIVERSAL PLUGIN SYSTEM READY                ║
╚══════════════════════════════════════════════════════════╝

👤 Admin: /admin/login
🔐 Password: From .env file
📧 Email: Resend.com integrated
🧩 Plugins: Auto-loaded (${this.plugins.size} loaded)
🛠️  Upload: /admin/plugins/upload
📊 Database: Simple JSON (No foreign key errors)
            `);
        });
    }
}

// Start ShadowCore
const shadowcore = new ShadowCore();
shadowcore.initialize().catch(console.error);

module.exports = shadowcore.app;
