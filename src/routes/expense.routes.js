const express = require('express');
const expenseController = require('../controllers/expense.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Expense routes
router
  .route('/')
  .post(expenseController.createExpense);

router
  .route('/group/:groupId')
  .get(expenseController.getGroupExpenses);

router
  .route('/:id')
  .get(expenseController.getExpense)
  .patch(expenseController.updateExpense)
  .delete(expenseController.deleteExpense);

module.exports = router;
