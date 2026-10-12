const express = require('express');
const { getCover } = require('../controllers/post-cover-controller');

const router = express.Router();

router.get('/media/posts/:id/cover', getCover);

module.exports = router;