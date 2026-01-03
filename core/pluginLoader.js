// core/pluginLoader.js - Universal Plugin Loader
const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');

class PluginLoader {
    constructor(app, db, email) {
        this.app = app;
        this.db = db;
        this.email = email;
        this.plugins = new Map();
        this.pluginDir = path.join(__dirname, '../plugins');
        this.viewsDir = path.join(__dirname, '../views/plugins');
    }

    async init() {
        console.log('🔌 Initializing Universal Plugin Loader...');
        
        // Create directories
        await this.createDirectories();
        
        // Load all plugins
        await this.loadAllPlugins();
        
        console.log(`✅ Plugin Loader Ready: ${this.plugins.size} plugins loaded`);
    }

    async createDirectories() {
        const dirs = [
            this.pluginDir,
            this.viewsDir,
            path.join(this.pluginDir, 'assets'),
            path.join(this.pluginDir, 'views')
        ];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (err) {
                // Directory exists
            }
        }
    }

    async loadAllPlugins() {
        try {
            const files = await fs.readdir(this.pluginDir);
            
            for (const file of files) {
                if (file.endsWith('.plugin.js')) {
                    await this.loadPlugin(path.join(this.pluginDir, file));
                }
            }
        } catch (err) {
            console.log('📁 No plugins directory found, creating...');
            await fs.mkdir(this.pluginDir, { recursive: true });
        }
    }

    async loadPlugin(filePath) {
        try {
            const pluginId = path.basename(filePath, '.plugin.js');
            
            // Clear require cache for hot reload
            delete require.cache[require.resolve(filePath)];
            
            // Load plugin module
            const pluginModule = require(filePath);
            
            // Create plugin object
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
                dependencies: pluginModule.dependencies || [],
                requiredEnv: pluginModule.requiredEnv || [],
                config: pluginModule.config || {}
            };

            // Check database for plugin status
            const dbStatus = await this.db.getPluginStatus(pluginId);
            if (dbStatus === false) {
                console.log(`⏸️  Plugin ${plugin.name} disabled in database`);
                return;
            }

            // Initialize plugin
            if (typeof pluginModule.init === 'function') {
                const initResult = await pluginModule.init({
                    app: this.app,
                    db: this.db,
                    email: this.email,
                    pluginId: plugin.id,
                    config: plugin.config
                });
                
                plugin.initResult = initResult;
            }

            // Register plugin routes
            if (pluginModule.routes && Array.isArray(pluginModule.routes)) {
                this.registerPluginRoutes(plugin);
            }

            // Register plugin middleware
            if (pluginModule.middleware && Array.isArray(pluginModule.middleware)) {
                this.registerPluginMiddleware(plugin);
            }

            // Load plugin views
            if (pluginModule.views) {
                await this.loadPluginViews(plugin);
            }

            // Store plugin
            this.plugins.set(pluginId, plugin);
            
            // Save to database
            await this.db.savePlugin(plugin);

            console.log(`✅ Loaded plugin: ${plugin.name} v${plugin.version}`);

        } catch (err) {
            console.error(`❌ Failed to load plugin ${filePath}:`, err.message);
        }
    }

    registerPluginRoutes(plugin) {
        if (!plugin.module.routes || !Array.isArray(plugin.module.routes)) {
            return;
        }

        plugin.module.routes.forEach(route => {
            const method = (route.method || 'GET').toLowerCase();
            const routePath = `/api/plugins/${plugin.id}${route.path}`;
            
            // Prepare middleware chain
            const handlers = [];
            
            // Add auth middleware if required
            if (route.auth) {
                const Auth = require('./auth');
                const auth = new Auth(this.db);
                handlers.push(auth.middleware(route.auth));
            }
            
            // Add route handler
            handlers.push(async (req, res) => {
                try {
                    const result = await route.handler({
                        req,
                        res,
                        db: this.db,
                        user: req.session?.user,
                        plugin: plugin,
                        config: plugin.config
                    });
                    
                    // Send response if not already sent
                    if (result && !res.headersSent) {
                        if (typeof result === 'object') {
                            res.json(result);
                        } else {
                            res.send(result);
                        }
                    }
                } catch (error) {
                    console.error(`Plugin ${plugin.id} route error:`, error);
                    if (!res.headersSent) {
                        res.status(500).json({ 
                            error: 'Plugin route error', 
                            message: error.message 
                        });
                    }
                }
            });
            
            // Register route
            this.app[method](routePath, ...handlers);
            console.log(`🛣️  Registered route: ${method.toUpperCase()} ${routePath}`);
        });
    }

    registerPluginMiddleware(plugin) {
        if (!plugin.module.middleware || !Array.isArray(plugin.module.middleware)) {
            return;
        }

        plugin.module.middleware.forEach(middleware => {
            if (typeof middleware === 'function') {
                this.app.use(middleware);
                console.log(`🔧 Registered middleware from plugin: ${plugin.name}`);
            }
        });
    }

    async loadPluginViews(plugin) {
        if (!plugin.module.views || typeof plugin.module.views !== 'object') {
            return;
        }

        const pluginViewDir = path.join(this.viewsDir, plugin.id);
        
        try {
            await fs.mkdir(pluginViewDir, { recursive: true });
            
            for (const [viewName, content] of Object.entries(plugin.module.views)) {
                const viewPath = path.join(pluginViewDir, `${viewName}.ejs`);
                await fs.writeFile(viewPath, content);
            }
            
            console.log(`📄 Loaded views for plugin: ${plugin.name}`);
        } catch (err) {
            console.error(`Failed to load views for ${plugin.name}:`, err);
        }
    }

    async reloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        // Remove from memory
        this.plugins.delete(pluginId);
        
        // Clear require cache
        delete require.cache[require.resolve(plugin.file)];
        
        // Reload plugin
        await this.loadPlugin(plugin.file);
        
        console.log(`🔄 Reloaded plugin: ${pluginId}`);
    }

    async installPluginDependencies(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin || !plugin.dependencies || plugin.dependencies.length === 0) {
            return { installed: [], alreadyInstalled: [] };
        }

        const packagePath = path.join(__dirname, '../package.json');
        const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        
        const toInstall = [];
        const alreadyInstalled = [];

        plugin.dependencies.forEach(dep => {
            if (!packageData.dependencies[dep]) {
                toInstall.push(dep);
                packageData.dependencies[dep] = 'latest';
            } else {
                alreadyInstalled.push(dep);
            }
        });

        if (toInstall.length > 0) {
            await fs.writeFile(packagePath, JSON.stringify(packageData, null, 2));
            console.log(`📦 Added dependencies to package.json: ${toInstall.join(', ')}`);
            
            // Note: Actual npm install needs to be run manually
            return {
                installed: toInstall,
                alreadyInstalled: alreadyInstalled,
                note: 'Dependencies added to package.json. Run "npm install" to install them.'
            };
        }

        return { installed: [], alreadyInstalled: alreadyInstalled };
    }

    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    getEnabledPlugins() {
        return this.getAllPlugins().filter(p => p.enabled);
    }

    async togglePlugin(pluginId, enabled) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        plugin.enabled = enabled;
        
        // Update in database
        await this.db.update('plugins', pluginId, { enabled });
        
        console.log(`🔧 Plugin ${plugin.name} ${enabled ? 'enabled' : 'disabled'}`);
        
        return plugin;
    }

    async uninstallPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        // Call uninstall hook if exists
        if (typeof plugin.module.uninstall === 'function') {
            await plugin.module.uninstall();
        }

        // Remove from memory
        this.plugins.delete(pluginId);
        
        // Remove from database
        await this.db.delete('plugins', pluginId);
        
        // Try to delete plugin file
        try {
            await fs.unlink(plugin.file);
        } catch (err) {
            // File might be in use or already deleted
        }

        console.log(`🗑️  Uninstalled plugin: ${plugin.name}`);
        
        return true;
    }
}

module.exports = PluginLoader;
