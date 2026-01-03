<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title || 'Activity Logs' %> | ShadowCore</title>
    <link rel="stylesheet" href="/static/css/main.css">
</head>
<body>
    <%- include('../partials/header', { currentPage: 'activity' }) %>
    
    <div class="container" style="margin-top: 80px; padding: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h1>📊 Activity Logs</h1>
            <button onclick="exportLogs()" class="btn btn-secondary">📥 Export Logs</button>
        </div>
        
        <% if (logs && logs.length > 0) { %>
            <div class="card">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border);">
                                <th style="text-align: left; padding: 1rem;">Action</th>
                                <th style="text-align: left; padding: 1rem;">Plugin</th>
                                <th style="text-align: left; padding: 1rem;">Status</th>
                                <th style="text-align: left; padding: 1rem;">Timestamp</th>
                                <th style="text-align: left; padding: 1rem;">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <% logs.forEach(log => { %>
                                <tr style="border-bottom: 1px solid var(--border-light);">
                                    <td style="padding: 1rem;">
                                        <span style="display: inline-block; padding: 0.25rem 0.75rem; background: rgba(99, 102, 241, 0.1); border-radius: 4px; font-size: 0.9rem;">
                                            <%= log.action || 'Unknown' %>
                                        </span>
                                    </td>
                                    <td style="padding: 1rem;">
                                        <%= log.plugin || 'System' %>
                                    </td>
                                    <td style="padding: 1rem;">
                                        <% if (log.result === 'success') { %>
                                            <span style="color: #10b981;">✅ Success</span>
                                        <% } else if (log.result === 'error') { %>
                                            <span style="color: #ef4444;">❌ Error</span>
                                        <% } else { %>
                                            <span style="color: #f59e0b;">⚠️ <%= log.result || 'Unknown' %></span>
                                        <% } %>
                                    </td>
                                    <td style="padding: 1rem; color: var(--text-secondary);">
                                        <%= new Date(log.timestamp).toLocaleString() %>
                                    </td>
                                    <td style="padding: 1rem;">
                                        <% if (log.details) { %>
                                            <button onclick="showLogDetails('<%= log.id %>')" class="btn btn-sm btn-secondary">
                                                View Details
                                            </button>
                                        <% } else if (log.error) { %>
                                            <button onclick="showError('Error: <%= log.error %>')" class="btn btn-sm btn-danger">
                                                View Error
                                            </button>
                                        <% } else { %>
                                            <span style="color: var(--text-muted);">No details</span>
                                        <% } %>
                                    </td>
                                </tr>
                            <% }) %>
                        </tbody>
                    </table>
                </div>
                
                <% if (logs.length === 0) { %>
                    <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
                        <h3>No activity logs yet</h3>
                        <p>Your activity will appear here once you start using plugins</p>
                    </div>
                <% } %>
            </div>
            
            <!-- Log Details Modal -->
            <div id="logModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 2000; align-items: center; justify-content: center;">
                <div class="card" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3>Log Details</h3>
                        <button onclick="closeLogModal()" class="btn btn-sm">✕</button>
                    </div>
                    <div id="logDetailsContent">
                        <!-- Content will be loaded here -->
                    </div>
                </div>
            </div>
            
        <% } else { %>
            <div class="card" style="text-align: center; padding: 3rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">📝</div>
                <h3>No activity logs yet</h3>
                <p style="color: var(--text-secondary); margin: 1rem 0;">
                    Your activity will appear here once you start using plugins
                </p>
                <a href="/plugins" class="btn btn-primary">Browse Plugins</a>
            </div>
        <% } %>
    </div>
    
    <script>
        function showLogDetails(logId) {
            // In a real implementation, this would fetch log details from the server
            const log = {
                id: logId,
                action: 'remove_background',
                plugin: 'removebg',
                timestamp: new Date().toISOString(),
                details: 'Image processed successfully. Size: 2.5MB, Format: PNG, Credits used: 1'
            };
            
            document.getElementById('logDetailsContent').innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <strong>Action:</strong>
                    <span style="display: inline-block; padding: 0.25rem 0.75rem; background: rgba(99, 102, 241, 0.1); border-radius: 4px; margin-left: 0.5rem;">
                        ${log.action}
                    </span>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <strong>Plugin:</strong> ${log.plugin}
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <strong>Timestamp:</strong> ${new Date(log.timestamp).toLocaleString()}
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <strong>Details:</strong>
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-top: 0.5rem; font-family: monospace;">
                        ${log.details}
                    </div>
                </div>
            `;
            
            document.getElementById('logModal').style.display = 'flex';
        }
        
        function showError(error) {
            document.getElementById('logDetailsContent').innerHTML = `
                <div style="color: #ef4444;">
                    <h4>❌ Error Details</h4>
                    <div style="background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 8px; margin-top: 0.5rem; font-family: monospace;">
                        ${error}
                    </div>
                </div>
            `;
            
            document.getElementById('logModal').style.display = 'flex';
        }
        
        function closeLogModal() {
            document.getElementById('logModal').style.display = 'none';
        }
        
        function exportLogs() {
            fetch('/api/user/logs/export')
                .then(res => res.json())
                .then(data => {
                    if (data.downloadUrl) {
                        window.open(data.downloadUrl, '_blank');
                    } else {
                        alert('Export feature coming soon!');
                    }
                });
        }
        
        // Close modal when clicking outside
        document.getElementById('logModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'logModal') {
                closeLogModal();
            }
        });
    </script>
</body>
</html>
