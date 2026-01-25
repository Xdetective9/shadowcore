const { db } = require('../utils/database');

// Check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    
    // For API requests, return JSON error
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    // For web requests, redirect to login
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/login');
}

// Check if user is admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    
    if (req.path.startsWith('/api/')) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }
    
    res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page.'
    });
}

// Check if user has specific role
function hasRole(role) {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            return next();
        }
        
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                error: `Role ${role} required`
            });
        }
        
        res.status(403).render('error', {
            title: 'Access Denied',
            message: `Role ${role} required to access this page.`
        });
    };
}

// Check if user owns the resource
function isOwner(table, idField = 'user_id') {
    return async (req, res, next) => {
        try {
            const resourceId = req.params.id;
            const userId = req.session.user.id;
            
            const result = await db.query(
                `SELECT * FROM ${table} WHERE id = $1 AND ${idField} = $2`,
                [resourceId, userId]
            );
            
            if (result.rows.length > 0 || req.session.user.role === 'admin') {
                return next();
            }
            
            res.status(403).json({
                success: false,
                error: 'You do not own this resource'
            });
        } catch (error) {
            console.error('Owner check error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };
}

// Rate limiting middleware
function rateLimit(maxRequests, windowMs) {
    const requests = new Map();
    
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!requests.has(ip)) {
            requests.set(ip, []);
        }
        
        const userRequests = requests.get(ip);
        
        // Remove old requests
        while (userRequests.length > 0 && userRequests[0] < now - windowMs) {
            userRequests.shift();
        }
        
        // Check if exceeded limit
        if (userRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.'
            });
        }
        
        // Add current request
        userRequests.push(now);
        
        // Cleanup old IPs (optional)
        if (Math.random() < 0.01) { // 1% chance to cleanup
            for (const [key, value] of requests.entries()) {
                if (value.length === 0 || value[value.length - 1] < now - windowMs) {
                    requests.delete(key);
                }
            }
        }
        
        next();
    };
}

// CSRF protection middleware
function csrfProtection(req, res, next) {
    // Skip for API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    // Generate CSRF token if not exists
    if (!req.session.csrfToken) {
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
    }
    
    // Make token available in views
    res.locals.csrfToken = req.session.csrfToken;
    
    // Verify token for POST requests
    if (req.method === 'POST') {
        const token = req.body._csrf || req.headers['x-csrf-token'];
        
        if (!token || token !== req.session.csrfToken) {
            return res.status(403).render('error', {
                title: 'CSRF Error',
                message: 'Invalid CSRF token. Please try again.'
            });
        }
    }
    
    next();
}

// Logging middleware
function requestLogger(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const userId = req.session.user?.id || 'anonymous';
        const ip = req.ip || req.connection.remoteAddress;
        
        console.log(`${new Date().toISOString()} ${ip} ${userId} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
        
        // Log to database if needed
        if (process.env.LOG_REQUESTS === 'true') {
            db.query(
                'INSERT INTO logs (level, message, user_id, ip_address, user_agent, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
                [
                    'info',
                    `${req.method} ${req.originalUrl} ${res.statusCode}`,
                    req.session.user?.id,
                    ip,
                    req.headers['user-agent'],
                    JSON.stringify({
                        duration,
                        statusCode: res.statusCode,
                        method: req.method,
                        path: req.path
                    })
                ]
            ).catch(console.error);
        }
    });
    
    next();
}

module.exports = {
    isAuthenticated,
    isAdmin,
    hasRole,
    isOwner,
    rateLimit,
    csrfProtection,
    requestLogger
};
