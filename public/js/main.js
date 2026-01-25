// ========== GLOBAL UTILITIES ==========
class ShadowCore {
    constructor() {
        this.socket = null;
        this.notifications = [];
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.init();
    }

    init() {
        this.initSocket();
        this.initTheme();
        this.initEventListeners();
        this.initPlugins();
        console.log('🚀 ShadowCore initialized');
    }

    // ========== SOCKET.IO ==========
    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('🔌 Connected to server');
        });
        
        this.socket.on('notification', (data) => {
            this.showNotification(data.type, data.message, data.duration);
        });
        
        this.socket.on('plugin:update', (data) => {
            console.log('📦 Plugin update:', data);
            this.showNotification('info', `Plugin ${data.plugin} ${data.action}`);
        });
        
        this.socket.on('user:update', (data) => {
            console.log('👤 User update:', data);
        });
    }

    // ========== THEME MANAGEMENT ==========
    initTheme() {
        // Apply saved theme
        this.applyTheme(this.currentTheme);
        
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Theme picker
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                this.setTheme(theme);
            });
        });
    }

    setTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme(theme);
        
        // Update active class
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === theme);
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.className = `theme-${theme}`;
        
        // Update theme toggle icon
        const icon = document.querySelector('#themeToggle i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    // ========== NOTIFICATION SYSTEM ==========
    showNotification(type, message, duration = 5000) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-progress"></div>
        `;
        
        container.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Progress bar animation
        const progress = notification.querySelector('.notification-progress');
        if (progress) {
            progress.style.animation = `progress ${duration}ms linear`;
        }
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
        
        return notification;
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // ========== EVENT LISTENERS ==========
    initEventListeners() {
        // Mobile menu toggle
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                    navMenu.classList.remove('active');
                }
            });
        }
        
        // Dropdowns
        document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = toggle.nextElementSibling;
                menu.classList.toggle('show');
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        });
        
        // Form validation
        this.initFormValidation();
        
        // Load more buttons
        this.initLoadMore();
    }

    // ========== FORM VALIDATION ==========
    initFormValidation() {
        document.querySelectorAll('form[data-validate]').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                const originalDisabled = submitBtn.disabled;
                
                // Show loading
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                submitBtn.disabled = true;
                
                try {
                    const formData = new FormData(form);
                    const response = await fetch(form.action, {
                        method: form.method,
                        body: formData
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result.success) {
                            this.showNotification('success', result.message || 'Success!');
                            
                            // Redirect if specified
                            if (result.redirect) {
                                setTimeout(() => {
                                    window.location.href = result.redirect;
                                }, 1500);
                            }
                            
                            // Reset form if needed
                            if (result.reset) {
                                form.reset();
                            }
                        } else {
                            this.showNotification('error', result.error || 'An error occurred');
                        }
                    } else {
                        throw new Error('Network response was not ok');
                    }
                } catch (error) {
                    console.error('Form submission error:', error);
                    this.showNotification('error', 'Network error. Please try again.');
                } finally {
                    // Restore button
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = originalDisabled;
                }
            });
        });
    }

    // ========== LOAD MORE FUNCTIONALITY ==========
    initLoadMore() {
        document.querySelectorAll('.load-more').forEach(button => {
            button.addEventListener('click', async (e) => {
                const container = e.target.closest('[data-load-container]');
                const url = e.target.dataset.loadUrl;
                const page = parseInt(e.target.dataset.page || 1);
                
                if (!container || !url) return;
                
                e.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                e.target.disabled = true;
                
                try {
                    const response = await fetch(`${url}?page=${page + 1}`);
                    const html = await response.text();
                    
                    container.insertAdjacentHTML('beforeend', html);
                    e.target.dataset.page = page + 1;
                    
                    // Hide button if no more items
                    if (!html.trim()) {
                        e.target.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Load more error:', error);
                    this.showNotification('error', 'Failed to load more items');
                } finally {
                    e.target.innerHTML = 'Load More';
                    e.target.disabled = false;
                }
            });
        });
    }

    // ========== PLUGIN INTEGRATION ==========
    initPlugins() {
        // This will be populated by plugin system
        window.plugins = {};
        
        // Expose core functions to plugins
        window.ShadowCore = {
            showNotification: (type, message, duration) => this.showNotification(type, message, duration),
            setTheme: (theme) => this.setTheme(theme),
            toggleTheme: () => this.toggleTheme(),
            socket: this.socket
        };
    }

    // ========== UTILITY FUNCTIONS ==========
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('success', 'Copied to clipboard!');
        }).catch(() => {
            this.showNotification('error', 'Failed to copy');
        });
    }

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// ========== INITIALIZE ON LOAD ==========
document.addEventListener('DOMContentLoaded', () => {
    window.shadowCore = new ShadowCore();
    
    // Add CSS for progress animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes progress {
            from { width: 100%; }
            to { width: 0%; }
        }
        .notification-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background: currentColor;
            opacity: 0.3;
            width: 100%;
            transform-origin: left;
        }
        .notification.show {
            animation: slideIn 0.3s ease;
        }
    `;
    document.head.appendChild(style);
});
