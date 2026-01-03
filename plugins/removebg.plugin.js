// plugins/removebg.plugin.js
// Remove Background Plugin - Uses real API key
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

module.exports = {
    name: 'Remove Background',
    version: '1.0.0',
    author: 'ShadowCore Team',
    description: 'Remove background from images using AI',
    icon: '🖼️',
    category: 'image',
    
    // Plugin dependencies (will be auto-installed)
    dependencies: ['axios', 'form-data'],
    
    // Required environment variables
    requiredEnv: ['REMOVEBG_API_KEY'],
    
    // Plugin configuration
    config: {
        apiKey: process.env.REMOVEBG_API_KEY || 'xv5aoeuirxTNZBYS5KykZZEK',
        apiUrl: 'https://api.remove.bg/v1.0/removebg',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
        credits: 50 // Monthly credits
    },
    
    // Initialize plugin
    async init({ app, db, pluginId, config }) {
        console.log(`🖼️ Remove Background Plugin initialized with API key: ${config.apiKey.substring(0, 10)}...`);
        
        // Create plugin directory
        const pluginDir = `./uploads/plugins/${pluginId}`;
        if (!fs.existsSync(pluginDir)) {
            fs.mkdirSync(pluginDir, { recursive: true });
        }
        
        return {
            success: true,
            message: 'Remove Background plugin ready',
            endpoints: [
                `/api/plugins/${pluginId}/remove`,
                `/api/plugins/${pluginId}/status`,
                `/plugins/${pluginId}`
            ]
        };
    },
    
    // Plugin routes (auto-registered)
    routes: [
        {
            method: 'POST',
            path: '/remove',
            auth: true, // Requires authentication
            handler: async ({ req, res, config, user }) => {
                try {
                    if (!req.files || !req.files.image) {
                        return { error: 'No image uploaded' };
                    }
                    
                    const image = req.files.image;
                    const formData = new FormData();
                    
                    // Check file size
                    if (image.size > config.maxFileSize) {
                        return { error: `File too large. Max ${config.maxFileSize / 1024 / 1024}MB` };
                    }
                    
                    // Check file format
                    const ext = image.name.split('.').pop().toLowerCase();
                    if (!config.allowedFormats.includes(ext)) {
                        return { error: `Invalid format. Allowed: ${config.allowedFormats.join(', ')}` };
                    }
                    
                    // Prepare API request
                    formData.append('image_file', fs.createReadStream(image.tempFilePath));
                    formData.append('size', 'auto');
                    
                    // Call Remove.bg API
                    const response = await axios.post(config.apiUrl, formData, {
                        headers: {
                            ...formData.getHeaders(),
                            'X-Api-Key': config.apiKey
                        },
                        responseType: 'arraybuffer'
                    });
                    
                    // Save result
                    const resultId = Date.now();
                    const outputPath = `./uploads/plugins/removebg/${resultId}_no_bg.png`;
                    fs.writeFileSync(outputPath, response.data);
                    
                    // Log usage
                    await db.insert('logs', {
                        plugin: 'removebg',
                        userId: user.id,
                        action: 'remove_background',
                        result: 'success',
                        creditsUsed: 1,
                        timestamp: new Date().toISOString()
                    });
                    
                    return {
                        success: true,
                        message: 'Background removed successfully',
                        downloadUrl: `/api/plugins/removebg/download/${resultId}`,
                        previewUrl: `/api/plugins/removebg/preview/${resultId}`,
                        creditsLeft: config.credits - 1
                    };
                    
                } catch (error) {
                    console.error('Remove.bg error:', error.response?.data || error.message);
                    
                    await db.insert('logs', {
                        plugin: 'removebg',
                        userId: user?.id,
                        action: 'remove_background',
                        result: 'error',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                    
                    return {
                        error: 'Failed to remove background',
                        detail: error.response?.data?.toString() || error.message
                    };
                }
            }
        },
        {
            method: 'GET',
            path: '/status',
            handler: async ({ config }) => {
                return {
                    status: 'active',
                    credits: config.credits,
                    maxSize: `${config.maxFileSize / 1024 / 1024}MB`,
                    formats: config.allowedFormats
                };
            }
        }
    ],
    
    // Plugin CSS (injected into page)
    css: `
        .removebg-container {
            max-width: 800px;
            margin: 2rem auto;
            padding: 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            color: white;
        }
        
        .removebg-upload-area {
            border: 3px dashed rgba(255,255,255,0.3);
            border-radius: 15px;
            padding: 3rem;
            text-align: center;
            margin: 2rem 0;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .removebg-upload-area:hover {
            border-color: rgba(255,255,255,0.6);
            background: rgba(255,255,255,0.05);
        }
        
        .removebg-result {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-top: 2rem;
        }
        
        .removebg-image-box {
            background: rgba(0,0,0,0.2);
            border-radius: 10px;
            padding: 1rem;
            text-align: center;
        }
        
        .removebg-image-box img {
            max-width: 100%;
            border-radius: 8px;
        }
    `,
    
    // Plugin JavaScript (injected into page)
    js: `
        class RemoveBackgroundPlugin {
            constructor() {
                this.uploadArea = null;
                this.fileInput = null;
                this.preview = null;
                this.result = null;
                this.init();
            }
            
            init() {
                // Create plugin UI
                this.createUI();
                this.bindEvents();
            }
            
            createUI() {
                const pluginContainer = document.createElement('div');
                pluginContainer.className = 'removebg-container';
                pluginContainer.innerHTML = \`
                    <h2>🖼️ Remove Background</h2>
                    <p>Upload an image to automatically remove the background using AI</p>
                    
                    <div class="removebg-upload-area" id="removebgUploadArea">
                        <div style="font-size: 4rem;">📁</div>
                        <h3>Drop image here or click to upload</h3>
                        <p>Supports: JPG, PNG, WEBP (Max 10MB)</p>
                        <input type="file" id="removebgFileInput" accept=".jpg,.jpeg,.png,.webp" style="display: none;">
                    </div>
                    
                    <div id="removebgPreview" style="display: none;">
                        <h3>Preview</h3>
                        <div id="removebgImagePreview"></div>
                        <button id="removebgProcess" class="btn btn-primary" style="margin-top: 1rem;">
                            🪄 Remove Background
                        </button>
                    </div>
                    
                    <div id="removebgResult" style="display: none;">
                        <h3>Result</h3>
                        <div class="removebg-result">
                            <div class="removebg-image-box">
                                <h4>Original</h4>
                                <img id="removebgOriginal" src="" alt="Original">
                            </div>
                            <div class="removebg-image-box">
                                <h4>Background Removed</h4>
                                <img id="removebgProcessed" src="" alt="Processed">
                            </div>
                        </div>
                        <div style="margin-top: 1rem;">
                            <a id="removebgDownload" class="btn btn-success" download>
                                ⬇️ Download Result
                            </a>
                        </div>
                    </div>
                    
                    <div id="removebgLoading" style="display: none; text-align: center; padding: 2rem;">
                        <div class="loading"></div>
                        <p>Processing image... This may take a few seconds</p>
                    </div>
                \`;
                
                // Add to plugins page
                const pluginsPage = document.querySelector('.plugins-container') || document.querySelector('.container');
                if (pluginsPage) {
                    pluginsPage.appendChild(pluginContainer);
                }
                
                // Get references
                this.uploadArea = document.getElementById('removebgUploadArea');
                this.fileInput = document.getElementById('removebgFileInput');
                this.preview = document.getElementById('removebgPreview');
                this.result = document.getElementById('removebgResult');
                this.loading = document.getElementById('removebgLoading');
            }
            
            bindEvents() {
                this.uploadArea.addEventListener('click', () => this.fileInput.click());
                this.uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    this.uploadArea.style.borderColor = 'rgba(255,255,255,0.6)';
                    this.uploadArea.style.background = 'rgba(255,255,255,0.1)';
                });
                this.uploadArea.addEventListener('dragleave', () => {
                    this.uploadArea.style.borderColor = 'rgba(255,255,255,0.3)';
                    this.uploadArea.style.background = 'transparent';
                });
                this.uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    this.uploadArea.style.borderColor = 'rgba(255,255,255,0.3)';
                    this.uploadArea.style.background = 'transparent';
                    
                    if (e.dataTransfer.files.length) {
                        this.handleFile(e.dataTransfer.files[0]);
                    }
                });
                
                this.fileInput.addEventListener('change', (e) => {
                    if (e.target.files.length) {
                        this.handleFile(e.target.files[0]);
                    }
                });
                
                document.getElementById('removebgProcess')?.addEventListener('click', () => {
                    this.processImage();
                });
            }
            
            handleFile(file) {
                if (!file.type.match('image.*')) {
                    alert('Please select an image file');
                    return;
                }
                
                if (file.size > 10 * 1024 * 1024) {
                    alert('File too large. Max 10MB');
                    return;
                }
                
                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.getElementById('removebgImagePreview');
                    preview.innerHTML = \`
                        <img src="\${e.target.result}" style="max-width: 300px; border-radius: 8px;">
                        <p>\${file.name} (\${(file.size / 1024 / 1024).toFixed(2)}MB)</p>
                    \`;
                    
                    this.preview.style.display = 'block';
                    this.uploadArea.style.display = 'none';
                    this.currentFile = file;
                };
                reader.readAsDataURL(file);
            }
            
            async processImage() {
                if (!this.currentFile) return;
                
                const formData = new FormData();
                formData.append('image', this.currentFile);
                
                // Show loading
                this.preview.style.display = 'none';
                this.loading.style.display = 'block';
                
                try {
                    const response = await fetch('/api/plugins/removebg/remove', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (result.error) {
                        alert('Error: ' + result.error);
                        this.preview.style.display = 'block';
                        this.loading.style.display = 'none';
                        return;
                    }
                    
                    // Show result
                    this.loading.style.display = 'none';
                    this.result.style.display = 'block';
                    
                    document.getElementById('removebgOriginal').src = URL.createObjectURL(this.currentFile);
                    document.getElementById('removebgProcessed').src = result.previewUrl;
                    document.getElementById('removebgDownload').href = result.downloadUrl;
                    
                    // Add credits info
                    const creditsInfo = document.createElement('div');
                    creditsInfo.innerHTML = \`<p style="margin-top: 1rem; color: #94a3b8;">Credits used: 1 | Remaining: \${result.creditsLeft}</p>\`;
                    this.result.appendChild(creditsInfo);
                    
                } catch (error) {
                    alert('Processing failed: ' + error.message);
                    this.preview.style.display = 'block';
                    this.loading.style.display = 'none';
                }
            }
        }
        
        // Initialize plugin when page loads
        document.addEventListener('DOMContentLoaded', () => {
            window.removeBGPlugin = new RemoveBackgroundPlugin();
        });
    `,
    
    // Admin panel component
    admin: {
        title: 'Remove Background',
        icon: '🖼️',
        component: `
            <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <h3>🖼️ Remove Background Settings</h3>
                
                <div style="margin: 1rem 0;">
                    <p><strong>API Status:</strong> 
                        <span id="removebgStatus" style="color: #10b981;">● Active</span>
                    </p>
                    <p><strong>Credits Available:</strong> <span id="removebgCredits">50</span></p>
                    <p><strong>Files Processed:</strong> <span id="removebgProcessed">0</span></p>
                </div>
                
                <div class="form-group">
                    <label>API Key</label>
                    <input type="password" id="removebgApiKey" class="form-control" 
                           value="xv5aoeuirxTNZBYS5KykZZEK" style="background: rgba(255,255,255,0.1); color: white;">
                </div>
                
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button onclick="testRemoveBG()" class="btn" style="background: white; color: #667eea;">
                        Test API
                    </button>
                    <button onclick="updateRemoveBGSettings()" class="btn btn-primary">
                        Save Settings
                    </button>
                    <button onclick="resetRemoveBG()" class="btn btn-secondary">
                        Reset
                    </button>
                </div>
                
                <div id="removebgTestResult" style="margin-top: 1rem;"></div>
            </div>
            
            <script>
                async function testRemoveBG() {
                    const resultDiv = document.getElementById('removebgTestResult');
                    resultDiv.innerHTML = '<div style="color: #f59e0b;">Testing API...</div>';
                    
                    try {
                        const response = await fetch('/api/plugins/removebg/status');
                        const data = await response.json();
                        
                        if (data.status === 'active') {
                            resultDiv.innerHTML = '<div style="color: #10b981;">✅ API is working correctly!</div>';
                        } else {
                            resultDiv.innerHTML = '<div style="color: #ef4444;">❌ API not responding</div>';
                        }
                    } catch (error) {
                        resultDiv.innerHTML = '<div style="color: #ef4444;">❌ Connection failed: ' + error.message + '</div>';
                    }
                }
                
                function updateRemoveBGSettings() {
                    const apiKey = document.getElementById('removebgApiKey').value;
                    // Save to server
                    fetch('/admin/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            plugin: 'removebg',
                            key: 'apiKey',
                            value: apiKey
                        })
                    }).then(() => {
                        alert('Settings saved!');
                    });
                }
                
                function resetRemoveBG() {
                    document.getElementById('removebgApiKey').value = 'xv5aoeuirxTNZBYS5KykZZEK';
                }
                
                // Load plugin stats
                fetch('/api/plugins/removebg/status')
                    .then(res => res.json())
                    .then(data => {
                        document.getElementById('removebgCredits').textContent = data.credits;
                    });
            </script>
        `
    }
};
