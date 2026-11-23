const express = require('express');
const groupController = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', groupController.listGroups);
router.get('/:id', groupController.getGroupById);
router.post('/', groupController.createGroup);
router.post('/:id/members', groupController.addMember);
router.delete('/:id/members/:userId', groupController.removeMember);
router.delete('/:id', groupController.deleteGroup);

module.exports = router;
