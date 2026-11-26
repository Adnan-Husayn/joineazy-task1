const { query, withTransaction } = require('../config/db');
const { AppError, asyncHandler, parseId } = require('../utils/errors');
const { createCourseSchema, enrollStudentSchema } = require('../validators/schemas');
const {
  loadTrackingSnapshot,
  isStudentVisibleForAssignment,
  evaluateStudentAssignmentStatus,
  buildAdminAnalyticsAndTracking,
  buildStudentCoursesSummary,
  buildAdminCoursesSummary,
} = require('../services/trackingService');

const listCourses = asyncHandler(async (req, res) => {
  const snapshot = await loadTrackingSnapshot();

  if (req.user.role === 'admin') {
    const courses = buildAdminCoursesSummary(snapshot, req.user.id);
    return res.status(200).json({ courses });
  }

  const courses = buildStudentCoursesSummary(req.user, snapshot);
  return res.status(200).json({ courses });
});

const getCourseById = asyncHandler(async (req, res) => {
  const courseId = parseId(req.params.id, 'course ID');
  const snapshot = await loadTrackingSnapshot();
  const baseCourse = snapshot.courseMap.get(courseId);

  if (!baseCourse) {
    throw new AppError('Course not found', 404);
  }

  if (req.user.role === 'student') {
    const enrolledSet = snapshot.enrolledStudentIdsByCourse.get(courseId);
    if (!enrolledSet || !enrolledSet.has(req.user.id)) {
      throw new AppError('You are not enrolled in this course', 403);
    }

    const courseSummary =
      buildStudentCoursesSummary(req.user, snapshot).find((c) => c.id === courseId) || baseCourse;

    const courseAssignments = snapshot.assignments.filter(
      (a) => a.courseId === courseId && isStudentVisibleForAssignment(a, req.user.id, snapshot)
    );

    const assignments = courseAssignments.map((assignment) => {
      const targetGroups = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
      const evalResult = evaluateStudentAssignmentStatus(assignment, req.user, snapshot);
      return {
        ...assignment,
        targetGroups,
        ...evalResult,
      };
    });

    return res.status(200).json({
      course: courseSummary,
      assignments,
    });
  }

  const courseSummary =
    buildAdminCoursesSummary(snapshot).find((c) => c.id === courseId) || baseCourse;

  const { perAssignment } = buildAdminAnalyticsAndTracking(snapshot);
  const statsByAssignmentId = new Map(perAssignment.map((a) => [a.assignmentId, a]));

  const assignments = snapshot.assignments
    .filter((a) => a.courseId === courseId)
    .map((assignment) => {
      const targetGroups = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
      const stats = statsByAssignmentId.get(assignment.id) || null;
      return {
        ...assignment,
        targetGroups,
        stats,
      };
    });

  const enrolledSet = snapshot.enrolledStudentIdsByCourse.get(courseId) || new Set();
  const enrolledStudents = snapshot.students
    .filter((s) => enrolledSet.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      studentId: s.studentId,
    }));

  return res.status(200).json({
    course: courseSummary,
    assignments,
    enrolledStudents,
  });
});

const createCourse = asyncHandler(async (req, res) => {
  const parsed = createCourseSchema.parse(req.body);
  const normalizedCode = parsed.code.trim().toUpperCase();

  const existing = await query('SELECT id FROM courses WHERE LOWER(code) = LOWER($1) LIMIT 1', [
    normalizedCode,
  ]);
  if (existing.rows.length > 0) {
    throw new AppError(`A course with code "${normalizedCode}" already exists`, 409);
  }

  const createdCourseId = await withTransaction(async (client) => {
    const insertRes = await client.query(
      `INSERT INTO courses (code, title, description, semester, accent_color, professor_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        normalizedCode,
        parsed.title.trim(),
        parsed.description || '',
        parsed.semester || 'Fall 2026',
        parsed.accentColor || 'indigo',
        req.user.id,
      ]
    );
    const courseId = insertRes.rows[0].id;

    if (parsed.enrollAllStudents) {
      await client.query(
        `INSERT INTO course_enrollments (course_id, student_id)
         SELECT $1, id FROM users WHERE role = 'student'
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [courseId]
      );
    } else if (parsed.studentIds && parsed.studentIds.length > 0) {
      const uniqueIds = [...new Set(parsed.studentIds)];
      const studentsCheck = await client.query(
        `SELECT id FROM users WHERE id = ANY($1::int[]) AND role = 'student'`,
        [uniqueIds]
      );
      if (studentsCheck.rows.length !== uniqueIds.length) {
        throw new AppError('One or more selected student IDs are invalid', 400);
      }
      for (const studentId of uniqueIds) {
        await client.query(
          `INSERT INTO course_enrollments (course_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (course_id, student_id) DO NOTHING`,
          [courseId, studentId]
        );
      }
    }

    return courseId;
  });

  const snapshot = await loadTrackingSnapshot();
  const course = buildAdminCoursesSummary(snapshot).find((c) => c.id === createdCourseId);

  res.status(201).json({ course });
});

const enrollStudent = asyncHandler(async (req, res) => {
  const courseId = parseId(req.params.id, 'course ID');
  const parsed = enrollStudentSchema.parse(req.body);

  const courseRes = await query('SELECT id, code, title FROM courses WHERE id = $1', [courseId]);
  if (courseRes.rows.length === 0) {
    throw new AppError('Course not found', 404);
  }
  const course = courseRes.rows[0];

  let studentRes;
  if (typeof parsed.studentId === 'number') {
    studentRes = await query(
      `SELECT id, name, email, student_id AS "studentId", role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [parsed.studentId]
    );
  } else {
    const identifier = (parsed.identifier || parsed.email || parsed.studentId || '').trim();
    studentRes = await query(
      `SELECT id, name, email, student_id AS "studentId", role
       FROM users
       WHERE LOWER(email) = LOWER($1) OR LOWER(student_id) = LOWER($1)
       LIMIT 1`,
      [identifier]
    );
  }

  if (studentRes.rows.length === 0) {
    throw new AppError('No student found matching that email or Student ID', 404);
  }

  const student = studentRes.rows[0];
  if (student.role !== 'student') {
    throw new AppError('Only student accounts can be enrolled in a course', 400);
  }

  const existingEnrollment = await query(
    `SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2`,
    [courseId, student.id]
  );
  if (existingEnrollment.rows.length > 0) {
    throw new AppError(`${student.name} is already enrolled in ${course.code}`, 409);
  }

  await query(
    `INSERT INTO course_enrollments (course_id, student_id)
     VALUES ($1, $2)`,
    [courseId, student.id]
  );

  res.status(201).json({
    message: `${student.name} enrolled in ${course.code}`,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      studentId: student.studentId,
    },
  });
});

module.exports = {
  listCourses,
  getCourseById,
  createCourse,
  enrollStudent,
};
