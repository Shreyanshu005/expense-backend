const settlementService = require('../services/settlement.service');
const AppError = require('../utils/appError');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// @desc    Create a new settlement
// @route   POST /api/settlements
// @access  Private
exports.createSettlement = async (req, res, next) => {
  try {
    const { groupId, paidToId, amount, description, method } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!groupId || !paidToId || !amount) {
      throw new AppError('Group ID, paid to user ID, and amount are required', 400);
    }

    if (isNaN(amount) || amount <= 0) {
      throw new AppError('Amount must be a positive number', 400);
    }

    if (userId === paidToId) {
      throw new AppError('You cannot settle with yourself', 400);
    }

    const settlement = await settlementService.createSettlement(userId, {
      groupId,
      paidToId,
      amount: parseFloat(amount),
      description,
      method: method || 'CASH',
    });

    res.status(201).json({
      status: 'success',
      data: {
        settlement,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all settlements for a group
// @route   GET /api/settlements/group/:groupId
// @access  Private
exports.getGroupSettlements = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    if (!groupId) {
      throw new AppError('Group ID is required', 400);
    }

    const settlements = await settlementService.getGroupSettlements(groupId, userId);

    res.status(200).json({
      status: 'success',
      results: settlements.length,
      data: {
        settlements,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get settlement by ID
// @route   GET /api/settlements/:id
// @access  Private
exports.getSettlement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const settlement = await settlementService.getSettlementById(id, userId);

    res.status(200).json({
      status: 'success',
      data: {
        settlement,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a settlement
// @route   DELETE /api/settlements/:id
// @access  Private
exports.deleteSettlement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await settlementService.deleteSettlement(id, userId);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's settlements across all groups
// @route   GET /api/settlements/me
// @access  Private
exports.getMySettlements = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const settlements = await settlementService.getUserSettlements(userId);

    res.status(200).json({
      status: 'success',
      results: settlements.length,
      data: {
        settlements,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get settlement suggestions (who should pay whom to settle up)
// @route   GET /api/settlements/suggestions/group/:groupId
// @access  Private
exports.getSettlementSuggestions = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    if (!groupId) {
      throw new AppError('Group ID is required', 400);
    }

    // Verify user is a member of the group
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (!isMember) {
      throw new AppError('You are not a member of this group', 403);
    }

    // Get all expenses and their splits for the group
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        paidBy: {
          select: {
            id: true,
            name: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Calculate balances
    const balances = new Map();

    expenses.forEach((expense) => {
      const paidBy = expense.paidById;
      const totalAmount = parseFloat(expense.amount);
      
      // Initialize user in balances if not exists
      if (!balances.has(paidBy)) {
        balances.set(paidBy, { user: expense.paidBy, amount: 0 });
      }
      
      // Add the full amount to the person who paid
      balances.get(paidBy).amount += totalAmount;

      // Subtract each person's share
      expense.splits.forEach((split) => {
        const userId = split.userId;
        const amount = parseFloat(split.amount);
        
        if (!balances.has(userId)) {
          balances.set(userId, { user: split.user, amount: 0 });
        }
        
        balances.get(userId).amount -= amount;
      });
    });

    // Convert to array and filter out zero balances
    const balanceList = Array.from(balances.values())
      .filter(b => Math.abs(b.amount) >= 0.01) // Ignore very small balances
      .map(b => ({
        user: b.user,
        amount: parseFloat(b.amount.toFixed(2)),
        type: b.amount > 0 ? 'owed' : 'owes',
      }));

    // Find potential settlement suggestions
    const suggestions = [];
    const positiveBalances = balanceList.filter(b => b.amount > 0).sort((a, b) => b.amount - a.amount);
    const negativeBalances = balanceList.filter(b => b.amount < 0).sort((a, b) => a.amount - b.amount);

    let i = 0;
    let j = 0;

    while (i < positiveBalances.length && j < negativeBalances.length) {
      const pos = positiveBalances[i];
      const neg = negativeBalances[j];
      
      const amount = Math.min(pos.amount, Math.abs(neg.amount));
      
      suggestions.push({
        from: neg.user,
        to: pos.user,
        amount: parseFloat(amount.toFixed(2)),
      });
      
      pos.amount -= amount;
      neg.amount += amount;
      
      if (Math.abs(pos.amount) < 0.01) i++;
      if (Math.abs(neg.amount) < 0.01) j++;
    }

    res.status(200).json({
      status: 'success',
      data: {
        balances: balanceList,
        suggestions,
      },
    });
  } catch (error) {
    next(error);
  }
};
