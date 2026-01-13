const express = require('express');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.get('/profile', requireLogin, (req, res) => {
  res.render('user/profile', { user: req.session.user });
});

router.get('/settings', requireLogin, (req, res) => {
  res.render('user/settings');
});

module.exports = router;
