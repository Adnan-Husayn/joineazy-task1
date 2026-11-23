const { query, withTransaction } = require('../config/db');
const { AppError, asyncHandler, parseId } = require('../utils/errors');
const { assignmentSchema } = require('../validators/schemas');
const {
  loadTrackingSnapshot,
  evaluateStudentAssignmentStatus,
  buildAdminAnalyticsAndTracking,
} = require('../services/trackingService');

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

  if (req.user.role === 'admin') {
    const { perAssignment } = buildAdminAnalyticsAndTracking(snapshot);
    const statsByAssignmentId = new Map(perAssignment.map((a) => [a.assignmentId, a]));

    const assignments = snapshot.assignments.map((assignment) => {
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
              isOverdue: stats.isOverdue,
            }
          : null,
      };
    });

    return res.status(200).json({ assignments });
  }

  const studentGroups = snapshot.studentGroupsMap.get(req.user.id) || [];
  const studentGroupIds = new Set(studentGroups.map((g) => g.id));

  const visibleAssignments = snapshot.assignments.filter((assignment) => {
    if (assignment.targetType === 'all') return true;
    const targets = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
    return targets.some((t) => studentGroupIds.has(t.id));
  });

  const assignments = visibleAssignments.map((assignment) => {
    const targetGroups = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
    const evalResult = evaluateStudentAssignmentStatus(assignment, req.user, snapshot);

    return {
      ...assignment,
      targetGroups,
      applicableGroups: evalResult.applicableGroups,
      groupStatuses: evalResult.groupStatuses,
      individualSubmission: evalResult.individualSubmission,
      status: evalResult.status,
      isOverdue: evalResult.isOverdue,
      canSubmit: evalResult.canSubmit,
      latestSubmission: evalResult.latestSubmission,
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

  const studentGroups = snapshot.studentGroupsMap.get(req.user.id) || [];
  const studentGroupIds = new Set(studentGroups.map((g) => g.id));
  const isEligible =
    assignment.targetType === 'all' || targetGroups.some((t) => studentGroupIds.has(t.id));

  if (!isEligible) {
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

  const createdId = await withTransaction(async (client) => {
    const validGroupIds =
      parsed.targetType === 'specific_groups'
        ? await validateTargetGroupsExist(client, parsed.targetGroupIds)
        : [];

    const insertRes = await client.query(
      `INSERT INTO assignments (title, description, due_date, onedrive_link, target_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        parsed.title,
        parsed.description || '',
        dueDateIso,
        parsed.onedriveLink,
        parsed.targetType,
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

  await withTransaction(async (client) => {
    const existing = await client.query('SELECT id FROM assignments WHERE id = $1', [assignmentId]);
    if (existing.rows.length === 0) {
      throw new AppError('Assignment not found', 404);
    }

    const validGroupIds =
      parsed.targetType === 'specific_groups'
        ? await validateTargetGroupsExist(client, parsed.targetGroupIds)
        : [];

    await client.query(
      `UPDATE assignments
       SET title = $1,
           description = $2,
           due_date = $3,
           onedrive_link = $4,
           target_type = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        parsed.title,
        parsed.description || '',
        dueDateIso,
        parsed.onedriveLink,
        parsed.targetType,
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
