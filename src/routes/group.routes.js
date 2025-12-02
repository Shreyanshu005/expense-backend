const express = require('express');
const groupController = require('../controllers/group.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Group routes
router
  .route('/')
  .post(groupController.createGroup)
  .get(groupController.getUserGroups);

router
  .route('/:id')
  .get(groupController.getGroup)
  .patch(groupController.updateGroup)
  .delete(groupController.deleteGroup);

router.post('/join', groupController.joinGroup);
router.post('/:id/regenerate-invite', groupController.regenerateInviteCode);
router.delete('/:groupId/members/:memberId', groupController.removeMember);

module.exports = router;
