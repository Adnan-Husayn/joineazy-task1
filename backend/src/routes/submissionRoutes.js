const express = require('express');
const submissionController = require('../controllers/submissionController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/confirm', requireRole('student'), submissionController.confirmSubmission);
router.get('/progress', requireRole('student'), submissionController.getStudentProgress);
router.get('/tracking', requireRole('admin'), submissionController.getTracking);
router.get('/analytics', requireRole('admin'), submissionController.getAnalytics);

module.exports = router;
