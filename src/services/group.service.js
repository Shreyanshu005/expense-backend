const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/appError');

const prisma = new PrismaClient();

// Helper function to generate a random invite code
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Create a new group
const createGroup = async (userId, { name, description }) => {
  const inviteCode = generateInviteCode();
  
  const group = await prisma.group.create({
    data: {
      name,
      description,
      inviteCode,
      createdBy: userId,
      members: {
        create: {
          userId,
        },
      },
    },
    include: {
      members: {
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

  return group;
};

// Get all groups for a user
const getUserGroups = async (userId) => {
  const groups = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          _count: {
            select: { members: true },
          },
          members: {
            take: 3,
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
      },
    },
  });

  return groups.map((member) => ({
    ...member.group,
    memberCount: member.group._count.members,
    members: member.group.members,
    _count: undefined,
  }));
};

// Get group details by ID
const getGroupById = async (groupId, userId) => {
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
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
      _count: {
        select: { members: true, expenses: true },
      },
    },
  });

  return group;
};

// Join a group using invite code
const joinGroup = async (userId, inviteCode) => {
  // Find group by invite code
  const group = await prisma.group.findUnique({
    where: { inviteCode },
  });

  if (!group) {
    throw new AppError('Invalid invite code', 400);
  }

  // Check if user is already a member
  const existingMember = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId,
    },
  });

  if (existingMember) {
    throw new AppError('You are already a member of this group', 400);
  }

  // Add user to group
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId,
    },
  });

  return { success: true, message: 'Successfully joined the group' };
};

// Update group
const updateGroup = async (groupId, userId, updateData) => {
  // Verify user is the creator of the group
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      createdBy: userId,
    },
  });

  if (!group) {
    throw new AppError('You are not authorized to update this group', 403);
  }

  const updatedGroup = await prisma.group.update({
    where: { id: groupId },
    data: {
      name: updateData.name || group.name,
      description: updateData.description || group.description,
    },
  });

  return updatedGroup;
};

// Delete group
const deleteGroup = async (groupId, userId) => {
  // Verify user is the creator of the group
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      createdBy: userId,
    },
  });

  if (!group) {
    throw new AppError('You are not authorized to delete this group', 403);
  }

  await prisma.$transaction([
    // Delete all expenses and their splits
    prisma.expenseSplit.deleteMany({
      where: {
        expense: {
          groupId,
        },
      },
    }),
    prisma.expense.deleteMany({
      where: {
        groupId,
      },
    }),
    // Delete all settlements
    prisma.settlement.deleteMany({
      where: {
        groupId,
      },
    }),
    // Delete all group members
    prisma.groupMember.deleteMany({
      where: {
        groupId,
      },
    }),
    // Finally, delete the group
    prisma.group.delete({
      where: {
        id: groupId,
      },
    }),
  ]);

  return { success: true, message: 'Group deleted successfully' };
};

// Remove member from group
const removeMember = async (groupId, adminId, memberId) => {
  // Verify admin is the creator of the group
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      createdBy: adminId,
    },
  });

  if (!group) {
    throw new AppError('You are not authorized to remove members from this group', 403);
  }

  // Don't allow removing yourself if you're the only admin
  if (adminId === memberId) {
    const memberCount = await prisma.groupMember.count({
      where: { groupId },
    });

    if (memberCount === 1) {
      throw new AppError('Cannot remove yourself as the only member. Delete the group instead.', 400);
    }
  }

  // Remove the member
  await prisma.groupMember.deleteMany({
    where: {
      groupId,
      userId: memberId,
    },
  });

  return { success: true, message: 'Member removed successfully' };
};

// Generate new invite code
const regenerateInviteCode = async (groupId, userId) => {
  // Verify user is the creator of the group
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      createdBy: userId,
    },
  });

  if (!group) {
    throw new AppError('You are not authorized to regenerate the invite code', 403);
  }

  const newInviteCode = generateInviteCode();

  const updatedGroup = await prisma.group.update({
    where: { id: groupId },
    data: {
      inviteCode: newInviteCode,
    },
  });

  return { inviteCode: updatedGroup.inviteCode };
};

module.exports = {
  createGroup,
  getUserGroups,
  getGroupById,
  joinGroup,
  updateGroup,
  deleteGroup,
  removeMember,
  regenerateInviteCode,
};
