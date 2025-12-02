const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);

// Protected routes (require authentication)
router.use(protect);

router.get('/me', authController.getMe);
router.patch('/update-password', authController.updatePassword);
router.get('/logout', authController.logout);

module.exports = router;
