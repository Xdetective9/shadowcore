const express = require('express');
const session = require('express-session');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs-extra');
const { initDB } = require('./database/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const pluginRoutes = require('./routes/plugins');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDB();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Auto-load plugins
const pluginsPath = path.join(__dirname, 'plugins');
if (fs.existsSync(pluginsPath)) {
  fs.readdirSync(pluginsPath).forEach(plugin => {
    const pluginPath = path.join(pluginsPath, plugin);
    if (fs.statSync(pluginPath).isDirectory()) {
      const pluginIndex = path.join(pluginPath, 'index.js');
      if (fs.existsSync(pluginIndex)) {
        require(pluginIndex)(app);
      }
    }
  });
}

// Routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/plugins', pluginRoutes);
app.use('/user', userRoutes);

app.get('/', (req, res) => {
  res.render('index', { user: req.session.user, siteName: process.env.SITE_NAME });
});

app.listen(PORT, () => {
  console.log(`Shadowcore running on port ${PORT}`);
});
