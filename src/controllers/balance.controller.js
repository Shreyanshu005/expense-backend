const balanceService = require('../services/balance.service');
const AppError = require('../utils/appError');

// @desc    Get balances for a specific group
// @route   GET /api/balances/group/:groupId
// @access  Private
exports.getGroupBalances = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    if (!groupId) {
      throw new AppError('Group ID is required', 400);
    }

    const balances = await balanceService.getGroupBalances(groupId, userId);

    res.status(200).json({
      status: 'success',
      data: balances,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's balances across all groups
// @route   GET /api/balances/me
// @access  Private
exports.getMyBalances = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const balances = await balanceService.getUserBalances(userId);

    res.status(200).json({
      status: 'success',
      data: balances,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get balances between two users in a group
// @route   GET /api/balances/group/:groupId/user/:userId
// @access  Private
exports.getUserBalanceInGroup = async (req, res, next) => {
  try {
    const { groupId, userId: otherUserId } = req.params;
    const currentUserId = req.user.id;

    if (!groupId || !otherUserId) {
      throw new AppError('Group ID and User ID are required', 400);
    }

    // Verify the current user is a member of the group
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: currentUserId,
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

    // Calculate balances between the two users
    let currentUserOwes = 0;
    let otherUserOwes = 0;

    expenses.forEach((expense) => {
      const paidByCurrentUser = expense.paidById === currentUserId;
      const paidByOtherUser = expense.paidById === otherUserId;

      // Skip if neither user is involved in this expense
      if (!paidByCurrentUser && !paidByOtherUser) {
        const currentUserInvolved = expense.splits.some(split => split.userId === currentUserId);
        const otherUserInvolved = expense.splits.some(split => split.userId === otherUserId);
        
        if (!currentUserInvolved || !otherUserInvolved) {
          return;
        }
      }

      // Find the split for the other user
      const currentUserSplit = expense.splits.find(split => split.userId === currentUserId);
      const otherUserSplit = expense.splits.find(split => split.userId === otherUserId);

      if (paidByCurrentUser) {
        // Current user paid, check if other user owes them
        if (otherUserSplit) {
          otherUserOwes += parseFloat(otherUserSplit.amount);
        }
      } else if (paidByOtherUser) {
        // Other user paid, check if current user owes them
        if (currentUserSplit) {
          currentUserOwes += parseFloat(currentUserSplit.amount);
        }
      } else {
        // Someone else paid, but both users are involved in the split
        if (currentUserSplit && otherUserSplit) {
          // No direct balance change between the two users
        }
      }
    });

    // Calculate net balance
    const netBalance = parseFloat((otherUserOwes - currentUserOwes).toFixed(2));

    // Get user details
    const [currentUser, otherUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: currentUserId },
        select: { id: true, name: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: otherUserId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    if (!otherUser) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: {
        users: {
          currentUser,
          otherUser,
        },
        balance: {
          currentUserOwes: parseFloat(currentUserOwes.toFixed(2)),
          otherUserOwes: parseFloat(otherUserOwes.toFixed(2)),
          netBalance,
          direction: netBalance > 0 ? 'theyOweYou' : netBalance < 0 ? 'youOweThem' : 'settled',
          amount: Math.abs(netBalance),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
