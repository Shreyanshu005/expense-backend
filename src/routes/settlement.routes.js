const express = require('express');
const settlementController = require('../controllers/settlement.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Settlement routes
router
  .route('/')
  .post(settlementController.createSettlement);

router
  .route('/group/:groupId')
  .get(settlementController.getGroupSettlements);

router
  .route('/me')
  .get(settlementController.getMySettlements);

router
  .route('/suggestions/group/:groupId')
  .get(settlementController.getSettlementSuggestions);

router
  .route('/:id')
  .get(settlementController.getSettlement)
  .delete(settlementController.deleteSettlement);

module.exports = router;
