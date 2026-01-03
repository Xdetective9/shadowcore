// Admin JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initAdminComponents();
    loadAdminStats();
    initPluginManager();
    initUserManager();
});

function initAdminComponents() {
    // Toggle plugin status
    document.querySelectorAll('.plugin-toggle').forEach(toggle => {
        toggle.addEventListener('change', function() {
            const pluginId = this.dataset.plugin;
            const enabled = this.checked;
            
            fetch(`/admin/api/plugins/${pluginId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showNotification('success', data.message);
                } else {
                    showNotification('error', data.error);
                    this.checked = !enabled; // Revert toggle
                }
            });
        });
    });
    
    // Delete plugin
    document.querySelectorAll('.plugin-delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const pluginId = this.dataset.plugin;
            const pluginName = this.dataset.name;
            
            if (confirm(`Are you sure you want to delete "${pluginName}"?`)) {
                fetch(`/admin/api/plugins/${pluginId}`, {
                    method: 'DELETE'
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showNotification('success', data.message);
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        showNotification('error', data.error);
                    }
                });
            }
        });
    });
    
    // User actions
    document.querySelectorAll('.user-action').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.user;
            const action = this.dataset.action;
            const userName = this.dataset.name;
            
            if (action === 'delete') {
                if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) {
                    return;
                }
            }
            
            fetch(`/admin/api/users/${userId}/${action}`, {
                method: 'POST'
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showNotification('success', data.message);
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showNotification('error', data.error);
                }
            });
        });
    });
    
    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            submitBtn.innerHTML = '<span class="loading"></span> Saving...';
            submitBtn.disabled = true;
            
            fetch(this.action, {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showNotification('success', data.message);
                } else {
                    showNotification('error', data.error);
                }
            })
            .finally(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
        });
    }
}

function loadAdminStats() {
    const statsContainer = document.querySelector('.admin-stats');
    if (!statsContainer) return;
    
    fetch('/admin/api/stats')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Update stat cards
                document.querySelectorAll('.stat-number').forEach(stat => {
                    const statName = stat.dataset.stat;
                    if (data.stats[statName] !== undefined) {
                        stat.textContent = data.stats[statName];
                    }
                });
                
                // Update charts if any
                if (window.Chart && data.charts) {
                    updateCharts(data.charts);
                }
            }
        });
}

function initPluginManager() {
    // Plugin search
    const searchInput = document.getElementById('pluginSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            const searchTerm = this.value.toLowerCase();
            
            document.querySelectorAll('.plugin-card').forEach(card => {
                const pluginName = card.dataset.name.toLowerCase();
                const pluginDesc = card.dataset.description.toLowerCase();
                
                if (pluginName.includes(searchTerm) || pluginDesc.includes(searchTerm)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }, 300));
    }
    
    // Plugin upload
    const uploadForm = document.getElementById('pluginUploadForm');
    if (uploadForm) {
        const fileInput = uploadForm.querySelector('input[type="file"]');
        const preview = document.getElementById('pluginPreview');
        
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                if (this.files.length > 0) {
                    const file = this.files[0];
                    preview.innerHTML = `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <p><strong>File:</strong> ${file.name}</p>
                            <p><strong>Size:</strong> ${formatBytes(file.size)}</p>
                            <p><strong>Type:</strong> ${file.type || 'Unknown'}</p>
                        </div>
                    `;
                }
            });
        }
        
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            submitBtn.innerHTML = '<span class="loading"></span> Uploading...';
            submitBtn.disabled = true;
            
            fetch(this.action, {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showNotification('success', data.message);
                    
                    if (data.dependencies && data.dependencies.length > 0) {
                        showNotification('info', 
                            `Plugin requires: ${data.dependencies.join(', ')}. They will be auto-installed.`);
                    }
                    
                    setTimeout(() => {
                        window.location.href = '/admin/plugins';
                    }, 2000);
                } else {
                    showNotification('error', data.error);
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            })
            .catch(error => {
                showNotification('error', 'Upload failed: ' + error.message);
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
        });
    }
}

function initUserManager() {
    // User search
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(function() {
            const searchTerm = this.value.toLowerCase();
            
            document.querySelectorAll('.user-row').forEach(row => {
                const userName = row.dataset.name.toLowerCase();
                const userEmail = row.dataset.email.toLowerCase();
                
                if (userName.includes(searchTerm) || userEmail.includes(searchTerm)) {
                    row.style.display = 'table-row';
                } else {
                    row.style.display = 'none';
                }
            });
        }, 300));
    }
    
    // Bulk actions
    const bulkAction = document.getElementById('bulkAction');
    const bulkApply = document.getElementById('bulkApply');
    const userCheckboxes = document.querySelectorAll('.user-checkbox');
    
    if (bulkApply && bulkAction) {
        bulkApply.addEventListener('click', function() {
            const selectedUsers = Array.from(userCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            
            if (selectedUsers.length === 0) {
                showNotification('warning', 'No users selected');
                return;
            }
            
            const action = bulkAction.value;
            let confirmMessage = '';
            
            switch (action) {
                case 'delete':
                    confirmMessage = `Delete ${selectedUsers.length} user(s)?`;
                    break;
                case 'verify':
                    confirmMessage = `Verify ${selectedUsers.length} user(s)?`;
                    break;
                case 'suspend':
                    confirmMessage = `Suspend ${selectedUsers.length} user(s)?`;
                    break;
                default:
                    showNotification('error', 'Invalid action');
                    return;
            }
            
            if (!confirm(confirmMessage)) return;
            
            fetch('/admin/api/users/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    users: selectedUsers,
                    action: action
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showNotification('success', data.message);
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showNotification('error', data.error);
                }
            });
        });
    }
    
    // Select all checkbox
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            userCheckboxes.forEach(cb => {
                cb.checked = this.checked;
            });
        });
    }
}

// Admin-specific utility functions
function updateCharts(chartData) {
    // Implement chart updates based on chartData
    // This would integrate with Chart.js or similar library
}

function exportData(type) {
    fetch(`/admin/api/export/${type}`)
        .then(res => res.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shadowcore-${type}-${new Date().toISOString().split('T')[0]}.${type}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        });
}

// Initialize admin socket
if (typeof io !== 'undefined') {
    const adminSocket = io('/admin');
    
    adminSocket.on('plugin_uploaded', (data) => {
        showNotification('success', `Plugin "${data.name}" uploaded by ${data.uploadedBy}`);
    });
    
    adminSocket.on('user_registered', (data) => {
        showNotification('info', `New user registered: ${data.email}`);
    });
    
    adminSocket.on('system_alert', (data) => {
        showNotification('warning', data.message, 'System Alert');
    });
}
