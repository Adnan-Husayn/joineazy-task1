const { query } = require('../config/db');
const { AppError, asyncHandler } = require('../utils/errors');
const { confirmSubmissionSchema } = require('../validators/schemas');
const {
  loadTrackingSnapshot,
  evaluateStudentAssignmentStatus,
  buildAdminAnalyticsAndTracking,
} = require('../services/trackingService');

const confirmSubmission = asyncHandler(async (req, res) => {
  const parsed = confirmSubmissionSchema.parse(req.body);

  const assignmentRes = await query(
    'SELECT id, title, target_type AS "targetType" FROM assignments WHERE id = $1',
    [parsed.assignmentId]
  );
  if (assignmentRes.rows.length === 0) {
    throw new AppError('Assignment not found', 404);
  }
  const assignment = assignmentRes.rows[0];

  const studentGroupsRes = await query(
    `SELECT gm.group_id AS "groupId", g.name AS "groupName"
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY g.name ASC`,
    [req.user.id]
  );
  const studentGroups = studentGroupsRes.rows;

  let applicableGroups = studentGroups;
  if (assignment.targetType === 'specific_groups') {
    const targetsRes = await query(
      'SELECT group_id AS "groupId" FROM assignment_targets WHERE assignment_id = $1',
      [assignment.id]
    );
    const targetGroupIds = new Set(targetsRes.rows.map((r) => r.groupId));
    applicableGroups = studentGroups.filter((g) => targetGroupIds.has(g.groupId));

    if (applicableGroups.length === 0) {
      throw new AppError('This assignment is not assigned to any of your groups', 403);
    }
  }

  let resolvedGroupId = parsed.groupId ?? null;
  let resolvedGroupName = null;

  if (resolvedGroupId !== null) {
    const matchedGroup = applicableGroups.find((g) => g.groupId === resolvedGroupId);
    if (!matchedGroup) {
      throw new AppError(
        'Selected group is invalid or is not assigned to this assignment',
        403
      );
    }
    resolvedGroupName = matchedGroup.groupName;
  } else if (applicableGroups.length === 1) {
    resolvedGroupId = applicableGroups[0].groupId;
    resolvedGroupName = applicableGroups[0].groupName;
  } else if (applicableGroups.length > 1) {
    throw new AppError('Please select which group you are confirming submission for', 400);
  }

  if (resolvedGroupId !== null) {
    const existingGroupSub = await query(
      'SELECT id FROM submissions WHERE assignment_id = $1 AND group_id = $2',
      [assignment.id, resolvedGroupId]
    );
    if (existingGroupSub.rows.length > 0) {
      throw new AppError(
        `Submission has already been confirmed for ${resolvedGroupName}`,
        409
      );
    }
  } else {
    const existingIndividualSub = await query(
      'SELECT id FROM submissions WHERE assignment_id = $1 AND group_id IS NULL AND confirmed_by = $2',
      [assignment.id, req.user.id]
    );
    if (existingIndividualSub.rows.length > 0) {
      throw new AppError('You have already confirmed submission for this assignment', 409);
    }
  }

  const insertRes = await query(
    `INSERT INTO submissions (assignment_id, group_id, confirmed_by, confirmation_note)
     VALUES ($1, $2, $3, $4)
     RETURNING id, assignment_id AS "assignmentId", group_id AS "groupId",
               confirmed_by AS "confirmedBy", confirmation_note AS "note",
               confirmed_at AS "confirmedAt"`,
    [assignment.id, resolvedGroupId, req.user.id, parsed.note || '']
  );

  const sub = insertRes.rows[0];
  res.status(201).json({
    message: resolvedGroupName
      ? `Submission confirmed for ${resolvedGroupName}`
      : 'Submission confirmed successfully',
    submission: {
      ...sub,
      groupName: resolvedGroupName,
      confirmedByName: req.user.name,
      confirmedByStudentId: req.user.studentId,
    },
  });
});

const getStudentProgress = asyncHandler(async (req, res) => {
  const snapshot = await loadTrackingSnapshot();
  const studentGroups = snapshot.studentGroupsMap.get(req.user.id) || [];
  const studentGroupIds = new Set(studentGroups.map((g) => g.id));

  const visibleAssignments = snapshot.assignments.filter((assignment) => {
    if (assignment.targetType === 'all') return true;
    const targets = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
    return targets.some((t) => studentGroupIds.has(t.id));
  });

  let completedAssignments = 0;
  let partialAssignments = 0;
  let pendingAssignments = 0;
  let overdueAssignments = 0;

  for (const assignment of visibleAssignments) {
    const evalResult = evaluateStudentAssignmentStatus(assignment, req.user, snapshot);
    if (evalResult.status === 'submitted') completedAssignments += 1;
    else if (evalResult.status === 'partial') partialAssignments += 1;
    else pendingAssignments += 1;

    if (evalResult.isOverdue) overdueAssignments += 1;
  }

  const totalAssignments = visibleAssignments.length;
  const overall = {
    totalAssignments,
    completedAssignments,
    partialAssignments,
    pendingAssignments,
    overdueAssignments,
    completionRate:
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0,
  };

  const { perGroup } = buildAdminAnalyticsAndTracking(snapshot);
  const groups = perGroup.filter((g) => studentGroupIds.has(g.groupId));

  res.status(200).json({ overall, groups });
});

const getTracking = asyncHandler(async (req, res) => {
  const snapshot = await loadTrackingSnapshot();
  const { groupWise, studentWise } = buildAdminAnalyticsAndTracking(snapshot);

  const assignmentIdFilter = req.query.assignmentId ? Number(req.query.assignmentId) : null;
  const statusFilter = (req.query.status || 'all').toString().toLowerCase();
  const searchTerm = (req.query.search || '').toString().trim().toLowerCase();

  function matchesFilters(row, type) {
    if (assignmentIdFilter && row.assignmentId !== assignmentIdFilter) {
      return false;
    }

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        if (!row.isOverdue) return false;
      } else if (row.status !== statusFilter) {
        return false;
      }
    }

    if (searchTerm) {
      const fields =
        type === 'group'
          ? [
              row.groupName,
              row.assignmentTitle,
              row.confirmedByName,
              row.confirmedByStudentId,
              ...row.members.map((m) => `${m.name} ${m.studentId || ''}`),
            ]
          : [
              row.studentName,
              row.studentEmail,
              row.studentCode,
              row.assignmentTitle,
              row.confirmedByName,
              ...row.applicableGroups.map((g) => g.name),
            ];

      const matches = fields.some(
        (field) => field && field.toString().toLowerCase().includes(searchTerm)
      );
      if (!matches) return false;
    }

    return true;
  }

  res.status(200).json({
    groupWise: groupWise.filter((row) => matchesFilters(row, 'group')),
    studentWise: studentWise.filter((row) => matchesFilters(row, 'student')),
  });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const snapshot = await loadTrackingSnapshot();
  const { summary, perAssignment, perGroup, recentActivity } =
    buildAdminAnalyticsAndTracking(snapshot);

  res.status(200).json({
    summary,
    perAssignment,
    perGroup,
    recentActivity,
  });
});

module.exports = {
  confirmSubmission,
  getStudentProgress,
  getTracking,
  getAnalytics,
};
