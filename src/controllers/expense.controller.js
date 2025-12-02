const expenseService = require('../services/expense.service');
const AppError = require('../utils/appError');

// @desc    Create a new expense
// @route   POST /api/expenses
// @access  Private
exports.createExpense = async (req, res, next) => {
  try {
    const { groupId, description, amount, category, splitType, splitBetween } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!groupId || !description || !amount || !splitType || !splitBetween) {
      throw new AppError('Missing required fields', 400);
    }

    if (isNaN(amount) || amount <= 0) {
      throw new AppError('Amount must be a positive number', 400);
    }

    if (!Array.isArray(splitBetween) || splitBetween.length === 0) {
      throw new AppError('At least one user must be included in the split', 400);
    }

    const expense = await expenseService.createExpense(userId, groupId, {
      description,
      amount: parseFloat(amount),
      category: category || 'Other',
      splitType,
      splitBetween,
    });

    res.status(201).json({
      status: 'success',
      data: {
        expense,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all expenses for a group
// @route   GET /api/expenses/group/:groupId
// @access  Private
exports.getGroupExpenses = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    if (!groupId) {
      throw new AppError('Group ID is required', 400);
    }

    const expenses = await expenseService.getGroupExpenses(groupId, userId);

    res.status(200).json({
      status: 'success',
      results: expenses.length,
      data: {
        expenses,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expense by ID
// @route   GET /api/expenses/:id
// @access  Private
exports.getExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const expense = await expenseService.getExpenseById(id, userId);

    res.status(200).json({
      status: 'success',
      data: {
        expense,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an expense
// @route   PATCH /api/expenses/:id
// @access  Private
exports.updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, amount, category, splitType, splitBetween } = req.body;
    const userId = req.user.id;

    // Validate at least one field is being updated
    if (!description && !amount && !category && !splitType && !splitBetween) {
      throw new AppError('At least one field must be updated', 400);
    }

    const updateData = {};
    if (description) updateData.description = description;
    if (amount) {
      if (isNaN(amount) || amount <= 0) {
        throw new AppError('Amount must be a positive number', 400);
      }
      updateData.amount = parseFloat(amount);
    }
    if (category) updateData.category = category;
    if (splitType) updateData.splitType = splitType;
    if (splitBetween) {
      if (!Array.isArray(splitBetween) || splitBetween.length === 0) {
        throw new AppError('At least one user must be included in the split', 400);
      }
      updateData.splitBetween = splitBetween;
    }

    const expense = await expenseService.updateExpense(id, userId, updateData);

    res.status(200).json({
      status: 'success',
      data: {
        expense,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
exports.deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await expenseService.deleteExpense(id, userId);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
