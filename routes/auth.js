const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { db } = require('../utils/database');

module.exports = function(app, io, db) {
    // Login page
    app.get('/auth/login', (req, res) => {
        if (req.session.user) {
            return res.redirect('/dashboard');
        }
        
        res.render('auth/login', {
            title: 'Login',
            currentPage: 'login',
            error: null,
            username: ''
        });
    });

    // Login processing
    app.post('/auth/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            // Validation
            if (!username || !password) {
                return res.render('auth/login', {
                    title: 'Login',
                    currentPage: 'login',
                    error: 'Username and password are required',
                    username
                });
            }
            
            // Find user
            const userResult = await db.query(
                'SELECT * FROM users WHERE username = $1 OR email = $1',
                [username]
            );
            
            if (userResult.rows.length === 0) {
                return res.render('auth/login', {
                    title: 'Login',
                    currentPage: 'login',
                    error: 'Invalid username or password',
                    username
                });
            }
            
            const user = userResult.rows[0];
            
            // Check password
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.render('auth/login', {
                    title: 'Login',
                    currentPage: 'login',
                    error: 'Invalid username or password',
                    username
                });
            }
            
            // Check if user is active
            if (user.status !== 'active') {
                return res.render('auth/login', {
                    title: 'Login',
                    currentPage: 'login',
                    error: 'Account is disabled. Please contact administrator.',
                    username
                });
            }
            
            // Update last login
            await db.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );
            
            // Create session
            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                theme: user.theme,
                createdAt: user.created_at
            };
            
            // Redirect based on role
            if (user.role === 'admin') {
                res.redirect('/admin');
            } else {
                res.redirect('/dashboard');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            res.render('auth/login', {
                title: 'Login',
                currentPage: 'login',
                error: 'An error occurred. Please try again.',
                username: req.body.username
            });
        }
    });

    // Signup page
    app.get('/auth/signup', (req, res) => {
        if (req.session.user) {
            return res.redirect('/dashboard');
        }
        
        res.render('auth/signup', {
            title: 'Sign Up',
            currentPage: 'signup',
            error: null,
            formData: {}
        });
    });

    // Signup processing
    app.post('/auth/signup', async (req, res) => {
        try {
            const { username, email, password, confirmPassword } = req.body;
            
            // Validation
            const errors = [];
            
            if (!username || username.length < 3) {
                errors.push('Username must be at least 3 characters');
            }
            
            if (!validator.isAlphanumeric(username.replace(/[_-]/g, ''))) {
                errors.push('Username can only contain letters, numbers, underscores and hyphens');
            }
            
            if (email && !validator.isEmail(email)) {
                errors.push('Invalid email address');
            }
            
            if (!password || password.length < 6) {
                errors.push('Password must be at least 6 characters');
            }
            
            if (password !== confirmPassword) {
                errors.push('Passwords do not match');
            }
            
            if (errors.length > 0) {
                return res.render('auth/signup', {
                    title: 'Sign Up',
                    currentPage: 'signup',
                    error: errors.join(', '),
                    formData: { username, email }
                });
            }
            
            // Check if username exists
            const existingUser = await db.query(
                'SELECT id FROM users WHERE username = $1 OR email = $2',
                [username, email]
            );
            
            if (existingUser.rows.length > 0) {
                return res.render('auth/signup', {
                    title: 'Sign Up',
                    currentPage: 'signup',
                    error: 'Username or email already exists',
                    formData: { username, email }
                });
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);
            
            // Create user
            const newUser = await db.query(
                `INSERT INTO users (username, email, password, role, theme) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING id, username, email, role, theme, created_at`,
                [username, email, hashedPassword, 'user', 'dark']
            );
            
            // Create session
            const user = newUser.rows[0];
            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                theme: user.theme,
                createdAt: user.created_at
            };
            
            // Send welcome notification
            if (io) {
                io.to(`user-${user.id}`).emit('notification', {
                    type: 'success',
                    message: 'Welcome to ShadowCore! Your account has been created successfully.'
                });
            }
            
            // Redirect to dashboard
            res.redirect('/dashboard');
            
        } catch (error) {
            console.error('Signup error:', error);
            res.render('auth/signup', {
                title: 'Sign Up',
                currentPage: 'signup',
                error: 'An error occurred. Please try again.',
                formData: req.body
            });
        }
    });

    // Logout
    app.get('/auth/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
            res.redirect('/');
        });
    });

    // Forgot password
    app.get('/auth/forgot', (req, res) => {
        res.render('auth/forgot', {
            title: 'Forgot Password',
            currentPage: 'forgot',
            error: null,
            success: null
        });
    });

    // Reset password
    app.get('/auth/reset/:token', async (req, res) => {
        try {
            const { token } = req.params;
            
            // Validate token (implement token validation logic)
            // This is a simplified version
            
            res.render('auth/reset', {
                title: 'Reset Password',
                currentPage: 'reset',
                error: null,
                token
            });
        } catch (error) {
            res.render('auth/forgot', {
                title: 'Forgot Password',
                currentPage: 'forgot',
                error: 'Invalid or expired reset token',
                success: null
            });
        }
    });
};
