function requireLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/auth/login');
}

function requireAdmin(req, res, next) {
  if (req.body.password === process.env.ADMIN_PASSWORD) return next();
  res.status(403).send('Access Denied');
}

module.exports = { requireLogin, requireAdmin };
