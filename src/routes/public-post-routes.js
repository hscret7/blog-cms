const express = require('express');
const {
  showHome,
  showPost
} = require('../controllers/public-post-controller');

const router = express.Router();

router.get('/', showHome);
router.get('/posts/:slug', showPost);

module.exports = router;