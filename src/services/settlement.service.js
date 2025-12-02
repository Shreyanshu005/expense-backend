const { PrismaClient } = require('@prisma/client');
const AppError = require('../utils/appError');

const prisma = new PrismaClient();

// Create a new settlement
const createSettlement = async (userId, { groupId, paidToId, amount, description, method }) => {
  // Validate amount
  if (amount <= 0) {
    throw new AppError('Amount must be greater than 0', 400);
  }

  // Verify both users are members of the group
  const [payer, receiver] = await Promise.all([
    prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    }),
    prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: paidToId,
      },
    }),
  ]);

  if (!payer || !receiver) {
    throw new AppError('Both users must be members of the group', 400);
  }

  // Create the settlement
  const settlement = await prisma.settlement.create({
    data: {
      amount,
      description: description || `Settlement from ${userId} to ${paidToId}`,
      method: method || 'CASH',
      paidById: userId,
      paidToId,
      groupId,
    },
    include: {
      payer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return settlement;
};

// Get all settlements for a group
const getGroupSettlements = async (groupId, userId) => {
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

  const settlements = await prisma.settlement.findMany({
    where: { groupId },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      payer: {
        select: {
          id: true,
          name: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return settlements;
};

// Get settlement by ID
const getSettlementById = async (settlementId, userId) => {
  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: {
      payer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
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

  if (!settlement) {
    throw new AppError('Settlement not found', 404);
  }

  // Check if user is a member of the group
  if (settlement.group.members.length === 0) {
    throw new AppError('You are not authorized to view this settlement', 403);
  }

  // Remove group members from response
  const { group, ...settlementData } = settlement;
  return {
    ...settlementData,
    group: {
      id: group.id,
      name: group.name,
    },
  };
};

// Delete a settlement
const deleteSettlement = async (settlementId, userId) => {
  // Get the settlement with group info
  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
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

  if (!settlement) {
    throw new AppError('Settlement not found', 404);
  }

  // Only the payer or an admin can delete the settlement
  if (settlement.paidById !== userId && settlement.group.members.length === 0) {
    throw new AppError('You are not authorized to delete this settlement', 403);
  }

  // Delete the settlement
  await prisma.settlement.delete({
    where: { id: settlementId },
  });

  return { success: true, message: 'Settlement deleted successfully' };
};

// Get user's settlements across all groups
const getUserSettlements = async (userId) => {
  // Get all groups the user is a member of
  const groupMemberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });

  const groupIds = groupMemberships.map((m) => m.groupId);

  // Get all settlements where the user is either the payer or receiver
  const settlements = await prisma.settlement.findMany({
    where: {
      OR: [
        { paidById: userId },
        { paidToId: userId },
      ],
      groupId: { in: groupIds },
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      payer: {
        select: {
          id: true,
          name: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return settlements;
};

module.exports = {
  createSettlement,
  getGroupSettlements,
  getSettlementById,
  deleteSettlement,
  getUserSettlements,
};
