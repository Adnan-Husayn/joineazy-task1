const express = require('express');
const courseController = require('../controllers/courseController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', courseController.listCourses);
router.get('/:id', courseController.getCourseById);
router.post('/', requireRole('admin'), courseController.createCourse);
router.post('/:id/enroll', requireRole('admin'), courseController.enrollStudent);

module.exports = router;
