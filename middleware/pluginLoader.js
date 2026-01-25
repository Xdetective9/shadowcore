const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');

class PluginLoader {
    constructor() {
        this.pluginsDir = path.join(__dirname, '../plugins');
        this.uploadDir = path.join(__dirname, '../uploads/plugins');
        this.tempDir = path.join(__dirname, '../temp');
        this.pluginConfigs = new Map();
    }

    async initialize() {
        await this.ensureDirectories();
        await this.loadAllPlugins();
    }

    async ensureDirectories() {
        const dirs = [this.pluginsDir, this.uploadDir, this.tempDir];
        
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
                console.log(chalk.cyan(`📁 Created directory: ${dir}`));
            }
        }
    }

    async loadAllPlugins() {
        console.log(chalk.blue('🔍 Scanning for plugins...'));
        
        try {
            const files = await fs.readdir(this.pluginsDir);
            let loadedCount = 0;
            
            for (const file of files) {
                if (file.endsWith('.plugin.js')) {
                    const pluginPath = path.join(this.pluginsDir, file);
                    await this.loadPluginFromFile(pluginPath);
                    loadedCount++;
                }
            }
            
            console.log(chalk.green(`✅ Loaded ${loadedCount} plugins`));
            return loadedCount;
        } catch (error) {
            console.error(chalk.red('❌ Error loading plugins:'), error);
            return 0;
        }
    }

    async loadPluginFromFile(filePath) {
        try {
            const pluginCode = await fs.readFile(filePath, 'utf8');
            const pluginId = path.basename(filePath, '.plugin.js');
            
            // Create safe sandbox
            const sandbox = {
                console,
                require,
                module: { exports: {} },
                exports: {},
                __filename: filePath,
                __dirname: path.dirname(filePath),
                process: {
                    ...process,
                    env: { ...process.env }
                },
                Buffer,
                setTimeout,
                clearTimeout,
                setInterval,
                clearInterval,
                URL,
                URLSearchParams
            };
            
            // Disallow dangerous modules
            const safeRequire = (moduleName) => {
                const blocked = ['child_process', 'fs', 'os', 'cluster', 'vm', 'worker_threads'];
                if (blocked.includes(moduleName)) {
                    throw new Error(`Module ${moduleName} is not allowed in plugins`);
                }
                return require(moduleName);
            };
            
            sandbox.require = safeRequire;
            
            // Execute plugin in sandbox
            vm.createContext(sandbox);
            const script = new vm.Script(pluginCode, {
                filename: filePath,
                timeout: 5000
            });
            
            script.runInContext(sandbox);
            
            const pluginData = sandbox.module.exports || sandbox.exports;
            
            if (!pluginData || typeof pluginData !== 'object') {
                throw new Error('Plugin must export an object');
            }
            
            // Validate plugin
            this.validatePlugin(pluginData, pluginId);
            
            // Create plugin instance
            const plugin = {
                id: pluginId,
                name: pluginData.name || pluginId,
                version: pluginData.version || '1.0.0',
                author: pluginData.author || 'Unknown',
                description: pluginData.description || 'No description',
                icon: pluginData.icon || '🧩',
                category: pluginData.category || 'utility',
                enabled: true,
                config: pluginData.config || {},
                dependencies: pluginData.dependencies || [],
                routes: pluginData.routes || [],
                adminPanel: pluginData.adminPanel,
                frontend: pluginData.frontend || {},
                hooks: pluginData.hooks || {},
                init: pluginData.init || (() => {}),
                destroy: pluginData.destroy || (() => {}),
                filePath: filePath,
                loadedAt: new Date(),
                staticPath: null,
                viewsPath: null
            };
            
            // Initialize plugin
            if (typeof plugin.init === 'function') {
                const initResult = await plugin.init(global.app, global.io, require('../utils/database').db);
                console.log(chalk.green(`✅ Plugin initialized: ${plugin.name} v${plugin.version}`));
                
                if (initResult && initResult.staticPath) {
                    plugin.staticPath = path.join(path.dirname(filePath), initResult.staticPath);
                }
                
                if (initResult && initResult.viewsPath) {
                    plugin.viewsPath = path.join(path.dirname(filePath), initResult.viewsPath);
                }
            }
            
            // Store plugin
            global.plugins.set(pluginId, plugin);
            
            // Save to database
            await this.savePluginToDB(plugin);
            
            return plugin;
            
        } catch (error) {
            console.error(chalk.red(`❌ Failed to load plugin ${filePath}:`), error.message);
            return null;
        }
    }

    validatePlugin(pluginData, pluginId) {
        const required = ['name', 'version'];
        
        for (const field of required) {
            if (!pluginData[field]) {
                throw new Error(`Plugin ${pluginId} missing required field: ${field}`);
            }
        }
        
        // Validate version format
        const versionRegex = /^\d+\.\d+\.\d+$/;
        if (!versionRegex.test(pluginData.version)) {
            throw new Error(`Plugin ${pluginId} has invalid version format. Use semver: x.y.z`);
        }
        
        // Validate dependencies format
        if (pluginData.dependencies && !Array.isArray(pluginData.dependencies)) {
            throw new Error(`Plugin ${pluginId} dependencies must be an array`);
        }
        
        // Validate routes format
        if (pluginData.routes && !Array.isArray(pluginData.routes)) {
            throw new Error(`Plugin ${pluginId} routes must be an array`);
        }
    }

    async savePluginToDB(plugin) {
        try {
            const { db } = require('../utils/database');
            
            await db.query(`
                INSERT INTO plugins (id, name, version, author, description, enabled, config, dependencies, routes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    version = EXCLUDED.version,
                    author = EXCLUDED.author,
                    description = EXCLUDED.description,
                    config = EXCLUDED.config,
                    dependencies = EXCLUDED.dependencies,
                    routes = EXCLUDED.routes,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                plugin.id,
                plugin.name,
                plugin.version,
                plugin.author,
                plugin.description,
                plugin.enabled,
                JSON.stringify(plugin.config),
                JSON.stringify(plugin.dependencies),
                JSON.stringify(plugin.routes)
            ]);
            
        } catch (error) {
            console.error(chalk.red('❌ Error saving plugin to DB:'), error);
        }
    }

    async registerPluginRoutes(app) {
        for (const [pluginId, plugin] of global.plugins) {
            if (plugin.enabled && plugin.routes && Array.isArray(plugin.routes)) {
                for (const route of plugin.routes) {
                    try {
                        const method = (route.method || 'GET').toLowerCase();
                        const path = `/api/plugins/${pluginId}${route.path}`;
                        const handler = route.handler;
                        
                        if (typeof handler === 'function') {
                            app[method](path, async (req, res, next) => {
                                try {
                                    // Add plugin context to request
                                    req.plugin = plugin;
                                    
                                    // Check authentication if required
                                    if (route.authenticated && !req.session.user) {
                                        return res.status(401).json({ error: 'Authentication required' });
                                    }
                                    
                                    // Check admin role if required
                                    if (route.admin && (!req.session.user || req.session.user.role !== 'admin')) {
                                        return res.status(403).json({ error: 'Admin access required' });
                                    }
                                    
                                    await handler(req, res, next);
                                } catch (error) {
                                    console.error(chalk.red(`❌ Plugin route error (${pluginId}${route.path}):`), error);
                                    res.status(500).json({ error: 'Internal plugin error' });
                                }
                            });
                            
                            console.log(chalk.cyan(`   → Route: ${method.toUpperCase()} ${path}`));
                        }
                    } catch (error) {
                        console.error(chalk.red(`❌ Error registering route for plugin ${pluginId}:`), error);
                    }
                }
            }
        }
    }

    async uploadPlugin(file) {
        const tempId = uuidv4();
        const tempDir = path.join(this.tempDir, tempId);
        const pluginId = path.basename(file.name, '.plugin.js').replace(/[^a-z0-9_-]/gi, '-');
        
        try {
            await fs.mkdir(tempDir, { recursive: true });
            
            // Move uploaded file
            const tempPath = path.join(tempDir, file.name);
            await file.mv(tempPath);
            
            // Check if it's a zip file
            if (file.name.endsWith('.zip')) {
                await this.extractZipPlugin(tempPath, pluginId);
            } else {
                await this.processSinglePlugin(tempPath, pluginId);
            }
            
            // Cleanup
            await fs.rm(tempDir, { recursive: true, force: true });
            
            return { success: true, pluginId, message: 'Plugin uploaded successfully' };
            
        } catch (error) {
            // Cleanup on error
            try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
            
            console.error(chalk.red('❌ Plugin upload failed:'), error);
            return { success: false, error: error.message };
        }
    }

    async extractZipPlugin(zipPath, pluginId) {
        const zip = new AdmZip(zipPath);
        const extractPath = path.join(this.pluginsDir, pluginId);
        
        // Extract zip
        zip.extractAllTo(extractPath, true);
        
        // Look for plugin manifest
        const manifestPath = path.join(extractPath, 'plugin.yaml');
        const pluginJsPath = path.join(extractPath, 'index.plugin.js');
        
        if (await this.fileExists(manifestPath)) {
            await this.processManifestPlugin(manifestPath, pluginId);
        } else if (await this.fileExists(pluginJsPath)) {
            await this.processSinglePlugin(pluginJsPath, pluginId);
        } else {
            throw new Error('No plugin manifest or main file found in zip');
        }
    }

    async processManifestPlugin(manifestPath, pluginId) {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest = yaml.load(manifestContent);
        
        // Validate manifest
        if (!manifest.name || !manifest.version) {
            throw new Error('Manifest missing required fields');
        }
        
        // Create plugin file
        const pluginCode = this.generatePluginFromManifest(manifest);
        const pluginPath = path.join(this.pluginsDir, `${pluginId}.plugin.js`);
        
        await fs.writeFile(pluginPath, pluginCode, 'utf8');
        
        // Copy static files if any
        const manifestDir = path.dirname(manifestPath);
        if (manifest.static && await this.fileExists(path.join(manifestDir, manifest.static))) {
            const staticSrc = path.join(manifestDir, manifest.static);
            const staticDest = path.join(this.pluginsDir, pluginId, 'static');
            await fs.cp(staticSrc, staticDest, { recursive: true });
        }
    }

    generatePluginFromManifest(manifest) {
        return `
module.exports = {
    name: ${JSON.stringify(manifest.name)},
    version: ${JSON.stringify(manifest.version)},
    author: ${JSON.stringify(manifest.author || 'Unknown')},
    description: ${JSON.stringify(manifest.description || '')},
    icon: ${JSON.stringify(manifest.icon || '🧩')},
    category: ${JSON.stringify(manifest.category || 'utility')},
    
    config: ${JSON.stringify(manifest.config || {})},
    dependencies: ${JSON.stringify(manifest.dependencies || [])},
    routes: ${JSON.stringify(manifest.routes || [])},
    
    adminPanel: ${JSON.stringify(manifest.adminPanel || null)},
    frontend: ${JSON.stringify(manifest.frontend || {})},
    hooks: ${JSON.stringify(manifest.hooks || {})},
    
    init: async function(app, io, db) {
        ${manifest.init || '// Plugin initialization'}
        return {
            staticPath: ${JSON.stringify(manifest.static || null)},
            viewsPath: ${JSON.stringify(manifest.views || null)}
        };
    },
    
    destroy: async function() {
        ${manifest.destroy || '// Plugin cleanup'}
    }
};
        `.trim();
    }

    async processSinglePlugin(filePath, pluginId) {
        const destPath = path.join(this.pluginsDir, `${pluginId}.plugin.js`);
        await fs.copyFile(filePath, destPath);
        await this.loadPluginFromFile(destPath);
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async togglePlugin(pluginId, enabled) {
        const plugin = global.plugins.get(pluginId);
        if (!plugin) {
            throw new Error('Plugin not found');
        }
        
        plugin.enabled = enabled;
        
        // Update database
        const { db } = require('../utils/database');
        await db.query('UPDATE plugins SET enabled = $1 WHERE id = $2', [enabled, pluginId]);
        
        // Call destroy if disabling
        if (!enabled && typeof plugin.destroy === 'function') {
            await plugin.destroy();
        }
        
        // Call init if enabling
        if (enabled && typeof plugin.init === 'function') {
            await plugin.init(global.app, global.io, require('../utils/database').db);
        }
        
        return plugin;
    }

    async deletePlugin(pluginId) {
        const plugin = global.plugins.get(pluginId);
        if (!plugin) {
            throw new Error('Plugin not found');
        }
        
        // Call destroy
        if (typeof plugin.destroy === 'function') {
            await plugin.destroy();
        }
        
        // Remove from memory
        global.plugins.delete(pluginId);
        
        // Delete file
        try {
            await fs.unlink(plugin.filePath);
        } catch (error) {
            console.warn(chalk.yellow(`⚠️ Could not delete plugin file: ${error.message}`));
        }
        
        // Remove from database
        const { db } = require('../utils/database');
        await db.query('DELETE FROM plugins WHERE id = $1', [pluginId]);
        
        return true;
    }
}

const pluginLoader = new PluginLoader();

// Export functions
async function loadAllPlugins() {
    return await pluginLoader.loadAllPlugins();
}

async function registerPluginRoutes(app) {
    return await pluginLoader.registerPluginRoutes(app);
}

async function uploadPlugin(file) {
    return await pluginLoader.uploadPlugin(file);
}

async function togglePlugin(pluginId, enabled) {
    return await pluginLoader.togglePlugin(pluginId, enabled);
}

async function deletePlugin(pluginId) {
    return await pluginLoader.deletePlugin(pluginId);
}

function getPlugin(pluginId) {
    return global.plugins.get(pluginId);
}

function getAllPlugins() {
    return Array.from(global.plugins.values());
}

module.exports = {
    loadAllPlugins,
    registerPluginRoutes,
    uploadPlugin,
    togglePlugin,
    deletePlugin,
    getPlugin,
    getAllPlugins,
    pluginLoader
};
