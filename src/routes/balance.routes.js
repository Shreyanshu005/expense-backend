const express = require('express');
const balanceController = require('../controllers/balance.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Balance routes
router.get('/group/:groupId', balanceController.getGroupBalances);
router.get('/me', balanceController.getMyBalances);
router.get('/group/:groupId/user/:userId', balanceController.getUserBalanceInGroup);

module.exports = router;
