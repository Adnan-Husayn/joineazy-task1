const { query, withTransaction } = require('../config/db');
const { AppError, asyncHandler, parseId } = require('../utils/errors');
const { assignmentSchema } = require('../validators/schemas');
const {
  loadTrackingSnapshot,
  isStudentVisibleForAssignment,
  evaluateStudentAssignmentStatus,
  buildAdminAnalyticsAndTracking,
} = require('../services/trackingService');

async function validateCourseExists(client, courseId) {
  if (courseId === null || courseId === undefined) return null;
  const courseRes = await client.query('SELECT id FROM courses WHERE id = $1', [courseId]);
  if (courseRes.rows.length === 0) {
    throw new AppError('Selected course does not exist', 400);
  }
  return courseId;
}

async function validateTargetGroupsExist(client, targetGroupIds) {
  if (!targetGroupIds || targetGroupIds.length === 0) return [];
  const uniqueIds = [...new Set(targetGroupIds)];
  const existing = await client.query('SELECT id FROM groups WHERE id = ANY($1::int[])', [
    uniqueIds,
  ]);
  if (existing.rows.length !== uniqueIds.length) {
    throw new AppError('One or more selected target groups do not exist', 400);
  }
  return uniqueIds;
}

const listAssignments = asyncHandler(async (req, res) => {
  const snapshot = await loadTrackingSnapshot();
  const courseIdFilter = req.query.courseId ? parseId(req.query.courseId, 'course ID') : null;

  if (req.user.role === 'admin') {
    const { perAssignment } = buildAdminAnalyticsAndTracking(snapshot);
    const statsByAssignmentId = new Map(perAssignment.map((a) => [a.assignmentId, a]));

    const visibleAssignments = courseIdFilter
      ? snapshot.assignments.filter((a) => a.courseId === courseIdFilter)
      : snapshot.assignments;

    const assignments = visibleAssignments.map((assignment) => {
      const targetGroups = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
      const stats = statsByAssignmentId.get(assignment.id);
      return {
        ...assignment,
        targetGroups,
        stats: stats
          ? {
              eligibleGroups: stats.eligibleGroups,
              submittedGroups: stats.submittedGroups,
              groupCompletionRate: stats.groupCompletionRate,
              eligibleStudents: stats.eligibleStudents,
              submittedStudents: stats.submittedStudents,
              studentCompletionRate: stats.studentCompletionRate,
              totalSlots: stats.totalSlots,
              completedSlots: stats.completedSlots,
              completionRate: stats.completionRate,
              isOverdue: stats.isOverdue,
            }
          : null,
      };
    });

    return res.status(200).json({ assignments });
  }

  const visibleAssignments = snapshot.assignments.filter((assignment) => {
    if (courseIdFilter && assignment.courseId !== courseIdFilter) {
      return false;
    }
    return isStudentVisibleForAssignment(assignment, req.user.id, snapshot);
  });

  const assignments = visibleAssignments.map((assignment) => {
    const targetGroups = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
    const evalResult = evaluateStudentAssignmentStatus(assignment, req.user, snapshot);

    return {
      ...assignment,
      targetGroups,
      ...evalResult,
    };
  });

  return res.status(200).json({ assignments });
});

const getAssignmentById = asyncHandler(async (req, res) => {
  const assignmentId = parseId(req.params.id, 'assignment ID');
  const snapshot = await loadTrackingSnapshot();
  const assignment = snapshot.assignments.find((a) => a.id === assignmentId);

  if (!assignment) {
    throw new AppError('Assignment not found', 404);
  }

  const targetGroups = snapshot.targetGroupsByAssignment.get(assignment.id) || [];

  if (req.user.role === 'admin') {
    const { perAssignment } = buildAdminAnalyticsAndTracking(snapshot);
    const stats = perAssignment.find((a) => a.assignmentId === assignment.id) || null;
    return res.status(200).json({
      assignment: {
        ...assignment,
        targetGroups,
        stats,
      },
    });
  }

  if (!isStudentVisibleForAssignment(assignment, req.user.id, snapshot)) {
    throw new AppError('You do not have access to this assignment', 403);
  }

  const evalResult = evaluateStudentAssignmentStatus(assignment, req.user, snapshot);
  return res.status(200).json({
    assignment: {
      ...assignment,
      targetGroups,
      ...evalResult,
    },
  });
});

const createAssignment = asyncHandler(async (req, res) => {
  const parsed = assignmentSchema.parse(req.body);
  const dueDateIso = new Date(parsed.dueDate).toISOString();
  const submissionType = parsed.submissionType || 'group';
  const effectiveTargetType = submissionType === 'individual' ? 'all' : parsed.targetType;

  const createdId = await withTransaction(async (client) => {
    const courseId = await validateCourseExists(client, parsed.courseId ?? null);
    const validGroupIds =
      effectiveTargetType === 'specific_groups'
        ? await validateTargetGroupsExist(client, parsed.targetGroupIds)
        : [];

    const insertRes = await client.query(
      `INSERT INTO assignments (course_id, title, description, due_date, onedrive_link, target_type, submission_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        courseId,
        parsed.title,
        parsed.description || '',
        dueDateIso,
        parsed.onedriveLink,
        effectiveTargetType,
        submissionType,
        req.user.id,
      ]
    );
    const assignmentId = insertRes.rows[0].id;

    for (const groupId of validGroupIds) {
      await client.query(
        `INSERT INTO assignment_targets (assignment_id, group_id)
         VALUES ($1, $2)
         ON CONFLICT (assignment_id, group_id) DO NOTHING`,
        [assignmentId, groupId]
      );
    }

    return assignmentId;
  });

  const snapshot = await loadTrackingSnapshot();
  const assignment = snapshot.assignments.find((a) => a.id === createdId);
  const { perAssignment } = buildAdminAnalyticsAndTracking(snapshot);
  const stats = perAssignment.find((a) => a.assignmentId === createdId) || null;

  res.status(201).json({
    assignment: {
      ...assignment,
      targetGroups: snapshot.targetGroupsByAssignment.get(createdId) || [],
      stats,
    },
  });
});

const updateAssignment = asyncHandler(async (req, res) => {
  const assignmentId = parseId(req.params.id, 'assignment ID');
  const parsed = assignmentSchema.parse(req.body);
  const dueDateIso = new Date(parsed.dueDate).toISOString();
  const submissionType = parsed.submissionType || 'group';
  const effectiveTargetType = submissionType === 'individual' ? 'all' : parsed.targetType;

  await withTransaction(async (client) => {
    const existing = await client.query(
      'SELECT id, course_id AS "courseId" FROM assignments WHERE id = $1',
      [assignmentId]
    );
    if (existing.rows.length === 0) {
      throw new AppError('Assignment not found', 404);
    }

    const nextCourseId =
      parsed.courseId !== undefined
        ? await validateCourseExists(client, parsed.courseId)
        : existing.rows[0].courseId;

    const validGroupIds =
      effectiveTargetType === 'specific_groups'
        ? await validateTargetGroupsExist(client, parsed.targetGroupIds)
        : [];

    await client.query(
      `UPDATE assignments
       SET course_id = $1,
           title = $2,
           description = $3,
           due_date = $4,
           onedrive_link = $5,
           target_type = $6,
           submission_type = $7,
           updated_at = NOW()
       WHERE id = $8`,
      [
        nextCourseId,
        parsed.title,
        parsed.description || '',
        dueDateIso,
        parsed.onedriveLink,
        effectiveTargetType,
        submissionType,
        assignmentId,
      ]
    );

    await client.query('DELETE FROM assignment_targets WHERE assignment_id = $1', [assignmentId]);

    for (const groupId of validGroupIds) {
      await client.query(
        `INSERT INTO assignment_targets (assignment_id, group_id)
         VALUES ($1, $2)
         ON CONFLICT (assignment_id, group_id) DO NOTHING`,
        [assignmentId, groupId]
      );
    }
  });

  const snapshot = await loadTrackingSnapshot();
  const assignment = snapshot.assignments.find((a) => a.id === assignmentId);
  const { perAssignment } = buildAdminAnalyticsAndTracking(snapshot);
  const stats = perAssignment.find((a) => a.assignmentId === assignmentId) || null;

  res.status(200).json({
    assignment: {
      ...assignment,
      targetGroups: snapshot.targetGroupsByAssignment.get(assignmentId) || [],
      stats,
    },
  });
});

const deleteAssignment = asyncHandler(async (req, res) => {
  const assignmentId = parseId(req.params.id, 'assignment ID');
  const deleted = await query('DELETE FROM assignments WHERE id = $1 RETURNING id', [assignmentId]);
  if (deleted.rows.length === 0) {
    throw new AppError('Assignment not found', 404);
  }

  res.status(200).json({ message: 'Assignment deleted successfully' });
});

module.exports = {
  listAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
