require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const chalk = require('chalk');

// Initialize app
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Global variables
global.plugins = new Map();
global.io = io;
global.appRoot = __dirname;

// ========== MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "https://api.remove.bg"]
        }
    }
}));

app.use(cors());
app.use(morgan('dev'));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    limits: { fileSize: 100 * 1024 * 1024 },
    abortOnLimit: true,
    safeFileNames: true,
    preserveExtension: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);
app.use('/auth/', limiter);

// ========== SESSION CONFIGURATION ==========
const sessionStore = new (require('connect-pg-simple')(session))({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    tableName: 'sessions',
    pruneSessionInterval: 60
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'shadowcore-production-secret-256-bit-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'strict'
    },
    name: 'shadowcore.sid'
}));

// ========== VIEW ENGINE ==========
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'plugins/views')
]);

// ========== STATIC FILES ==========
app.use('/static', express.static(path.join(__dirname, 'public'), {
    maxAge: '1y',
    etag: true,
    lastModified: true
}));

// Plugin static files
app.use('/plugin-static/:pluginId', (req, res, next) => {
    const pluginId = req.params.pluginId;
    const plugin = global.plugins.get(pluginId);
    
    if (plugin && plugin.staticPath) {
        express.static(plugin.staticPath)(req, res, next);
    } else {
        next();
    }
});

// ========== DATABASE INITIALIZATION ==========
const { initDatabase, db } = require('./utils/database');

// ========== PLUGIN LOADER INITIALIZATION ==========
const { loadAllPlugins, registerPluginRoutes } = require('./middleware/pluginLoader');

// ========== GLOBAL MIDDLEWARE ==========
app.use((req, res, next) => {
    // Make plugins available in all views
    res.locals.plugins = Array.from(global.plugins.values()).filter(p => p.enabled);
    res.locals.user = req.session.user;
    res.locals.theme = req.cookies.theme || 'dark';
    res.locals.appName = process.env.APP_NAME || 'ShadowCore';
    res.locals.ownerName = process.env.OWNER_NAME || 'Abdullah';
    res.locals.ownerContact = process.env.OWNER_CONTACT || '+923288055104';
    next();
});

// ========== ROUTES ==========
// Load routes dynamically
const fs = require('fs').promises;
const routeDir = path.join(__dirname, 'routes');

async function loadRoutes() {
    try {
        const files = await fs.readdir(routeDir);
        
        for (const file of files) {
            if (file.endsWith('.js')) {
                const route = require(path.join(routeDir, file));
                
                if (typeof route === 'function') {
                    route(app, io, db);
                } else if (route.router) {
                    const path = route.path || `/${file.replace('.js', '')}`;
                    app.use(path, route.router);
                }
                
                console.log(chalk.green(`✓ Route loaded: ${file}`));
            }
        }
    } catch (error) {
        console.error(chalk.red('Error loading routes:'), error);
    }
}

// ========== ERROR HANDLING ==========
app.use((req, res, next) => {
    res.status(404).render('error', {
        title: '404 - Not Found',
        message: 'The page you are looking for does not exist.',
        error: null
    });
});

app.use((err, req, res, next) => {
    console.error(chalk.red('Error:'), err);
    
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!';
    
    res.status(status).render('error', {
        title: `${status} - Error`,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err : null
    });
});

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
    console.log(chalk.cyan(`🔌 Socket connected: ${socket.id}`));
    
    socket.on('plugin:status', (data) => {
        socket.emit('plugin:status:response', {
            plugins: Array.from(global.plugins.values()).map(p => ({
                id: p.id,
                name: p.name,
                enabled: p.enabled,
                version: p.version
            }))
        });
    });
    
    socket.on('admin:notification', (data) => {
        socket.to('admin-room').emit('notification', data);
    });
    
    socket.on('disconnect', () => {
        console.log(chalk.yellow(`🔌 Socket disconnected: ${socket.id}`));
    });
});

// ========== START SERVER ==========
async function startServer() {
    try {
        console.log(chalk.blue('🚀 Starting ShadowCore...'));
        
        // Initialize database
        await initDatabase();
        console.log(chalk.green('✓ Database initialized'));
        
        // Load all plugins
        await loadAllPlugins();
        console.log(chalk.green(`✓ Plugins loaded: ${global.plugins.size}`));
        
        // Register plugin routes
        await registerPluginRoutes(app);
        console.log(chalk.green('✓ Plugin routes registered'));
        
        // Load main routes
        await loadRoutes();
        console.log(chalk.green('✓ Main routes loaded'));
        
        // Start server
        server.listen(PORT, HOST, () => {
            console.log(`
${chalk.magenta.bold('╔══════════════════════════════════════════════════════════╗')}
${chalk.magenta.bold('║')}           ${chalk.cyan.bold('🚀 SHADOWCORE v3.0 STARTED')}                ${chalk.magenta.bold('║')}
${chalk.magenta.bold('╠══════════════════════════════════════════════════════════╣')}
${chalk.magenta.bold('║')} ${chalk.yellow('📍 Host:')} ${HOST}:${PORT}                                ${chalk.magenta.bold('║')}
${chalk.magenta.bold('║')} ${chalk.yellow('🌐 URL:')} http://${HOST}:${PORT}                          ${chalk.magenta.bold('║')}
${chalk.magenta.bold('║')} ${chalk.yellow('⚡ Env:')} ${process.env.NODE_ENV || 'development'}         ${chalk.magenta.bold('║')}
${chalk.magenta.bold('║')} ${chalk.yellow('🔌 Plugins:')} ${global.plugins.size} loaded                ${chalk.magenta.bold('║')}
${chalk.magenta.bold('╠══════════════════════════════════════════════════════════╣')}
${chalk.magenta.bold('║')}           ${chalk.green.bold('✅ ALL SYSTEMS OPERATIONAL')}               ${chalk.magenta.bold('║')}
${chalk.magenta.bold('╚══════════════════════════════════════════════════════════╝')}

${chalk.cyan('👤 Owner:')} ${process.env.OWNER_NAME || 'Abdullah'}
${chalk.cyan('📞 Contact:')} ${process.env.OWNER_CONTACT || '+923288055104'}
${chalk.cyan('🔐 Admin:')} /admin/login
${chalk.cyan('🧩 Plugins:')} /plugins
${chalk.cyan('📊 Dashboard:')} /dashboard
${chalk.cyan('🏥 Health:')} /health
            `);
        });
        
    } catch (error) {
        console.error(chalk.red.bold('❌ Failed to start server:'), error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(chalk.red.bold('⚠️ Uncaught Exception:'), error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red.bold('⚠️ Unhandled Rejection at:'), promise, 'reason:', reason);
});

// Start the server
startServer();

module.exports = { app, server, io };
