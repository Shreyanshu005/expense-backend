const { PrismaClient } = require('@prisma/client');
const AppError = require('../utils/appError');

const prisma = new PrismaClient();

// Helper function to calculate splits
const calculateSplits = (amount, splitType, splitBetween) => {
  const splits = [];
  let totalPercentage = 0;
  let totalAmount = 0;

  switch (splitType) {
    case 'EQUAL': {
      const splitAmount = parseFloat((amount / splitBetween.length).toFixed(2));
      const lastAmount = amount - splitAmount * (splitBetween.length - 1);

      splitBetween.forEach((split, index) => {
        const isLast = index === splitBetween.length - 1;
        splits.push({
          userId: split.userId,
          amount: isLast ? parseFloat(lastAmount.toFixed(2)) : splitAmount,
        });
      });
      break;
    }

    case 'EXACT': {
      splitBetween.forEach((split) => {
        totalAmount += split.amount;
        splits.push({
          userId: split.userId,
          amount: split.amount,
        });
      });

      if (totalAmount !== amount) {
        throw new AppError(
          `The sum of exact amounts (${totalAmount}) does not equal the total expense amount (${amount})`,
          400
        );
      }
      break;
    }

    case 'PERCENTAGE': {
      splitBetween.forEach((split) => {
        totalPercentage += split.percentage;
        const splitAmount = parseFloat(((amount * split.percentage) / 100).toFixed(2));
        splits.push({
          userId: split.userId,
          amount: splitAmount,
          percentage: split.percentage,
        });
      });

      if (totalPercentage !== 100) {
        throw new AppError(
          `The sum of percentages (${totalPercentage}%) must equal 100%`,
          400
        );
      }
      break;
    }

    default:
      throw new AppError('Invalid split type. Must be EQUAL, EXACT, or PERCENTAGE', 400);
  }

  return splits;
};

// Create a new expense
const createExpense = async (userId, groupId, expenseData) => {
  const { description, amount, category, splitType, splitBetween } = expenseData;

  // Validate split type
  if (!['EQUAL', 'EXACT', 'PERCENTAGE'].includes(splitType)) {
    throw new AppError('Invalid split type. Must be EQUAL, EXACT, or PERCENTAGE', 400);
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

  // Validate all users in splitBetween are group members
  const userIds = splitBetween.map((split) => split.userId);
  const members = await prisma.groupMember.findMany({
    where: {
      groupId,
      userId: { in: userIds },
    },
  });

  if (members.length !== new Set(userIds).size) {
    throw new AppError('One or more users are not members of this group', 400);
  }

  // Calculate splits
  const splits = calculateSplits(amount, splitType, splitBetween);

  // Create expense and splits in a transaction
  const expense = await prisma.$transaction(async (prisma) => {
    // Create the expense
    const newExpense = await prisma.expense.create({
      data: {
        description,
        amount,
        category,
        splitType,
        paidById: userId,
        groupId,
        splits: {
          create: splits,
        },
      },
      include: {
        splits: true,
        paidBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return newExpense;
  });

  return expense;
};

// Get all expenses for a group
const getGroupExpenses = async (groupId, userId) => {
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

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: {
      paidBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      splits: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return expenses;
};

// Get expense by ID
const getExpenseById = async (expenseId, userId) => {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      paidBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      splits: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          members: {
            where: { userId },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!expense) {
    throw new AppError('Expense not found', 404);
  }

  // Check if user is a member of the group
  if (expense.group.members.length === 0) {
    throw new AppError('You are not authorized to view this expense', 403);
  }

  // Remove group from response
  const { group, ...expenseData } = expense;
  return expenseData;
};

// Update an expense
const updateExpense = async (expenseId, userId, updateData) => {
  const { description, amount, category, splitType, splitBetween } = updateData;

  // Get the expense with group info
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        select: {
          members: {
            where: { userId },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!expense) {
    throw new AppError('Expense not found', 404);
  }

  // Check if user is a member of the group
  if (expense.group.members.length === 0) {
    throw new AppError('You are not authorized to update this expense', 403);
  }

  // If split details are being updated, validate and recalculate splits
  let splits;
  if (splitType && splitBetween) {
    splits = calculateSplits(amount || expense.amount, splitType, splitBetween);
  }

  // Update expense in a transaction
  const updatedExpense = await prisma.$transaction(async (prisma) => {
    // Delete existing splits if split details are being updated
    if (splits) {
      await prisma.expenseSplit.deleteMany({
        where: { expenseId },
      });
    }

    // Update the expense
    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        description: description || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        category: category || undefined,
        splitType: splitType || undefined,
        ...(splits && {
          splits: {
            create: splits,
          },
        }),
      },
      include: {
        paidBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return updatedExpense;
  });

  return updatedExpense;
};

// Delete an expense
const deleteExpense = async (expenseId, userId) => {
  // Get the expense with group info
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        select: {
          members: {
            where: { userId },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!expense) {
    throw new AppError('Expense not found', 404);
  }

  // Check if user is a member of the group
  if (expense.group.members.length === 0) {
    throw new AppError('You are not authorized to delete this expense', 403);
  }

  // Delete the expense (cascading deletes will handle the splits)
  await prisma.expense.delete({
    where: { id: expenseId },
  });

  return { success: true, message: 'Expense deleted successfully' };
};

module.exports = {
  createExpense,
  getGroupExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
