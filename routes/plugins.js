const express = require('express');
const router = express.Router();

router.get('/remove-background', (req, res) => {
  res.render('plugins/remove-background');
});

module.exports = router;
