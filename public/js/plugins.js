// ========== PLUGIN MANAGEMENT SYSTEM ==========
class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.init();
    }

    init() {
        this.loadPlugins();
        this.bindEvents();
    }

    async loadPlugins() {
        try {
            const response = await fetch('/api/plugins');
            const data = await response.json();
            
            if (data.success) {
                data.plugins.forEach(plugin => {
                    this.registerPlugin(plugin);
                });
                console.log(`✅ Loaded ${data.plugins.length} plugins`);
            }
        } catch (error) {
            console.error('Failed to load plugins:', error);
        }
    }

    registerPlugin(plugin) {
        this.plugins.set(plugin.id, plugin);
        
        // Inject plugin CSS if exists
        if (plugin.frontend?.css) {
            this.injectCSS(plugin.id, plugin.frontend.css);
        }
        
        // Execute plugin JS if exists
        if (plugin.frontend?.js) {
            this.executeJS(plugin.id, plugin.frontend.js);
        }
        
        // Register plugin routes
        if (plugin.routes) {
            this.registerRoutes(plugin);
        }
    }

    injectCSS(pluginId, css) {
        const style = document.createElement('style');
        style.id = `plugin-${pluginId}-css`;
        style.textContent = css;
        document.head.appendChild(style);
    }

    executeJS(pluginId, js) {
        try {
            // Create a function from the plugin JS
            const pluginFunction = new Function('plugin', 'ShadowCore', js);
            pluginFunction(this.plugins.get(pluginId), window.ShadowCore);
        } catch (error) {
            console.error(`Failed to execute plugin ${pluginId} JS:`, error);
        }
    }

    registerRoutes(plugin) {
        // Plugin routes are already registered server-side
        // This is for client-side routing if needed
        console.log(`📦 Plugin ${plugin.name} routes registered`);
    }

    bindEvents() {
        // Plugin toggle
        document.addEventListener('click', async (e) => {
            if (e.target.closest('[data-plugin-toggle]')) {
                const button = e.target.closest('[data-plugin-toggle]');
                const pluginId = button.dataset.pluginId;
                const enabled = button.dataset.enabled === 'true';
                
                await this.togglePlugin(pluginId, !enabled, button);
            }
            
            // Plugin delete
            if (e.target.closest('[data-plugin-delete]')) {
                const button = e.target.closest('[data-plugin-delete]');
                const pluginId = button.dataset.pluginId;
                
                if (confirm(`Are you sure you want to delete plugin "${pluginId}"?`)) {
                    await this.deletePlugin(pluginId, button);
                }
            }
            
            // Plugin upload
            if (e.target.closest('#pluginUploadForm')) {
                e.preventDefault();
                await this.uploadPlugin(e.target.closest('#pluginUploadForm'));
            }
        });
    }

    async togglePlugin(pluginId, enabled, button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
        
        try {
            const response = await fetch(`/admin/plugins/${pluginId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.ShadowCore.showNotification('success', result.message);
                
                // Update button state
                button.dataset.enabled = enabled;
                button.innerHTML = enabled ? '<i class="fas fa-toggle-on"></i> Enabled' : '<i class="fas fa-toggle-off"></i> Disabled';
                button.className = enabled ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
                
                // Reload page after delay
                setTimeout(() => location.reload(), 1000);
            } else {
                window.ShadowCore.showNotification('error', result.error);
                button.innerHTML = originalText;
            }
        } catch (error) {
            console.error('Toggle plugin error:', error);
            window.ShadowCore.showNotification('error', 'Network error');
            button.innerHTML = originalText;
        } finally {
            button.disabled = false;
        }
    }

    async deletePlugin(pluginId, button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
        
        try {
            const response = await fetch(`/admin/plugins/${pluginId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.ShadowCore.showNotification('success', result.message);
                
                // Remove plugin card
                const card = button.closest('.plugin-card');
                if (card) {
                    card.style.opacity = '0.5';
                    setTimeout(() => card.remove(), 300);
                }
                
                // Remove from plugins map
                this.plugins.delete(pluginId);
            } else {
                window.ShadowCore.showNotification('error', result.error);
                button.innerHTML = originalText;
            }
        } catch (error) {
            console.error('Delete plugin error:', error);
            window.ShadowCore.showNotification('error', 'Network error');
            button.innerHTML = originalText;
        } finally {
            button.disabled = false;
        }
    }

    async uploadPlugin(form) {
        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/admin/plugins/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.ShadowCore.showNotification('success', result.message);
                form.reset();
                
                // Reload page after delay
                setTimeout(() => location.reload(), 1500);
            } else {
                window.ShadowCore.showNotification('error', result.error);
                submitBtn.innerHTML = originalText;
            }
        } catch (error) {
            console.error('Upload plugin error:', error);
            window.ShadowCore.showNotification('error', 'Network error');
            submitBtn.innerHTML = originalText;
        } finally {
            submitBtn.disabled = false;
        }
    }

    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    // Plugin marketplace functions
    async installPlugin(pluginId) {
        try {
            const response = await fetch(`/api/plugins/${pluginId}/install`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.ShadowCore.showNotification('success', 'Plugin installed successfully');
                return true;
            } else {
                window.ShadowCore.showNotification('error', result.error);
                return false;
            }
        } catch (error) {
            console.error('Install plugin error:', error);
            window.ShadowCore.showNotification('error', 'Network error');
            return false;
        }
    }

    // Plugin configuration
    async savePluginConfig(pluginId, config) {
        try {
            const response = await fetch(`/api/plugins/${pluginId}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.ShadowCore.showNotification('success', 'Configuration saved');
                return true;
            } else {
                window.ShadowCore.showNotification('error', result.error);
                return false;
            }
        } catch (error) {
            console.error('Save config error:', error);
            window.ShadowCore.showNotification('error', 'Network error');
            return false;
        }
    }
}

// ========== PLUGIN TEMPLATE SYSTEM ==========
class PluginTemplate {
    static createCard(plugin) {
        return `
            <div class="plugin-card" data-plugin-id="${plugin.id}">
                <div class="plugin-header">
                    <div class="plugin-icon">
                        ${plugin.icon || '🧩'}
                    </div>
                    <div class="plugin-info">
                        <h3>${plugin.name}</h3>
                        <p class="plugin-description">${plugin.description || 'No description'}</p>
                        <div class="plugin-meta">
                            <span class="badge">v${plugin.version}</span>
                            <span class="badge">${plugin.author || 'Unknown'}</span>
                            <span class="badge">${plugin.category || 'Utility'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="plugin-actions">
                    <button class="btn btn-primary btn-sm" onclick="window.pluginManager.installPlugin('${plugin.id}')">
                        <i class="fas fa-download"></i> Install
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.location.href='/plugins/${plugin.id}'">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        `;
    }

    static createAdminCard(plugin) {
        const enabled = plugin.enabled !== false;
        
        return `
            <div class="plugin-card admin-plugin-card" data-plugin-id="${plugin.id}">
                <div class="plugin-header">
                    <div class="plugin-icon">
                        ${plugin.icon || '🧩'}
                    </div>
                    <div class="plugin-info">
                        <h3>${plugin.name} <small>v${plugin.version}</small></h3>
                        <p class="plugin-description">${plugin.description || 'No description'}</p>
                        <div class="plugin-meta">
                            <span class="badge ${enabled ? 'bg-success' : 'bg-secondary'}">
                                <i class="fas fa-${enabled ? 'check-circle' : 'times-circle'}"></i>
                                ${enabled ? 'Enabled' : 'Disabled'}
                            </span>
                            <span class="badge bg-info">${plugin.author || 'Unknown'}</span>
                            <span class="badge bg-warning">${plugin.id}</span>
                        </div>
                    </div>
                </div>
                
                <div class="plugin-actions">
                    <button class="btn btn-sm ${enabled ? 'btn-success' : 'btn-secondary'}" 
                            data-plugin-toggle 
                            data-plugin-id="${plugin.id}" 
                            data-enabled="${enabled}">
                        <i class="fas fa-${enabled ? 'toggle-on' : 'toggle-off'}"></i>
                        ${enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    
                    <button class="btn btn-info btn-sm" onclick="window.location.href='/admin/plugins/${plugin.id}'">
                        <i class="fas fa-cog"></i> Configure
                    </button>
                    
                    <button class="btn btn-danger btn-sm" 
                            data-plugin-delete 
                            data-plugin-id="${plugin.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }
}

// ========== INITIALIZE PLUGIN MANAGER ==========
document.addEventListener('DOMContentLoaded', () => {
    window.pluginManager = new PluginManager();
    window.PluginTemplate = PluginTemplate;
    
    // Initialize plugin cards
    const pluginContainer = document.getElementById('plugins-container');
    if (pluginContainer && window.pluginData) {
        window.pluginData.forEach(plugin => {
            const card = PluginTemplate.createCard(plugin);
            pluginContainer.insertAdjacentHTML('beforeend', card);
        });
    }
});
