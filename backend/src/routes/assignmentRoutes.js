const express = require('express');
const assignmentController = require('../controllers/assignmentController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', assignmentController.listAssignments);
router.get('/:id', assignmentController.getAssignmentById);
router.post('/', requireRole('admin'), assignmentController.createAssignment);
router.put('/:id', requireRole('admin'), assignmentController.updateAssignment);
router.delete('/:id', requireRole('admin'), assignmentController.deleteAssignment);

module.exports = router;
