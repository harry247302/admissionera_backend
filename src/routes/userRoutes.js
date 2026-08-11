const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.get('/profile', authenticate, userController.getProfile);
router.get('/', authenticate, authorize('admin'), userController.getAllUsers);

module.exports = router;
