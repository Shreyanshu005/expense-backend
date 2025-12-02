const groupService = require('../services/group.service');
const AppError = require('../utils/appError');

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
exports.createGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;

    if (!name) {
      throw new AppError('Group name is required', 400);
    }

    const group = await groupService.createGroup(userId, { name, description });

    res.status(201).json({
      status: 'success',
      data: {
        group,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all groups for the current user
// @route   GET /api/groups
// @access  Private
exports.getUserGroups = async (req, res, next) => {
  try {
    const groups = await groupService.getUserGroups(req.user.id);

    res.status(200).json({
      status: 'success',
      results: groups.length,
      data: {
        groups,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get group details
// @route   GET /api/groups/:id
// @access  Private
exports.getGroup = async (req, res, next) => {
  try {
    const group = await groupService.getGroupById(req.params.id, req.user.id);

    res.status(200).json({
      status: 'success',
      data: {
        group,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Join a group using invite code
// @route   POST /api/groups/join
// @access  Private
exports.joinGroup = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      throw new AppError('Invite code is required', 400);
    }

    const result = await groupService.joinGroup(req.user.id, inviteCode);

    res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update group
// @route   PATCH /api/groups/:id
// @access  Private
exports.updateGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const { id } = req.params;
    const userId = req.user.id;

    if (!name && !description) {
      throw new AppError('At least one field (name or description) is required', 400);
    }

    const group = await groupService.updateGroup(id, userId, { name, description });

    res.status(200).json({
      status: 'success',
      data: {
        group,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete group
// @route   DELETE /api/groups/:id
// @access  Private
exports.deleteGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await groupService.deleteGroup(id, userId);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from group
// @route   DELETE /api/groups/:groupId/members/:memberId
// @access  Private
exports.removeMember = async (req, res, next) => {
  try {
    const { groupId, memberId } = req.params;
    const adminId = req.user.id;

    const result = await groupService.removeMember(groupId, adminId, memberId);

    res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate group invite code
// @route   POST /api/groups/:id/regenerate-invite
// @access  Private
exports.regenerateInviteCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await groupService.regenerateInviteCode(id, userId);

    res.status(200).json({
      status: 'success',
      data: {
        inviteCode: result.inviteCode,
      },
    });
  } catch (error) {
    next(error);
  }
};
