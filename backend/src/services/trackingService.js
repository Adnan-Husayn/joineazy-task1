const { query } = require('../config/db');

async function loadTrackingSnapshot() {
  const [groupsRes, membersRes, studentsRes, assignmentsRes, targetsRes, submissionsRes] =
    await Promise.all([
      query(
        `SELECT g.id, g.name, g.description, g.created_by AS "createdBy", g.created_at AS "createdAt",
                u.name AS "createdByName"
         FROM groups g
         JOIN users u ON u.id = g.created_by
         ORDER BY g.created_at ASC, g.id ASC`
      ),
      query(
        `SELECT gm.group_id AS "groupId", gm.user_id AS "userId", gm.role_in_group AS "roleInGroup",
                gm.joined_at AS "joinedAt", u.name, u.email, u.student_id AS "studentId"
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         ORDER BY CASE WHEN gm.role_in_group = 'leader' THEN 0 ELSE 1 END, gm.joined_at ASC`
      ),
      query(
        `SELECT id, name, email, student_id AS "studentId", created_at AS "createdAt"
         FROM users
         WHERE role = 'student'
         ORDER BY name ASC`
      ),
      query(
        `SELECT a.id, a.title, a.description, a.due_date AS "dueDate", a.onedrive_link AS "onedriveLink",
                a.target_type AS "targetType", a.created_by AS "createdBy",
                a.created_at AS "createdAt", a.updated_at AS "updatedAt",
                u.name AS "createdByName"
         FROM assignments a
         JOIN users u ON u.id = a.created_by
         ORDER BY a.due_date ASC, a.created_at DESC`
      ),
      query(
        `SELECT at.assignment_id AS "assignmentId", at.group_id AS "groupId", g.name AS "groupName"
         FROM assignment_targets at
         JOIN groups g ON g.id = at.group_id
         ORDER BY g.name ASC`
      ),
      query(
        `SELECT s.id, s.assignment_id AS "assignmentId", s.group_id AS "groupId",
                s.confirmed_by AS "confirmedBy", s.confirmation_note AS "note",
                s.confirmed_at AS "confirmedAt",
                u.name AS "confirmedByName", u.student_id AS "confirmedByStudentId",
                g.name AS "groupName"
         FROM submissions s
         JOIN users u ON u.id = s.confirmed_by
         LEFT JOIN groups g ON g.id = s.group_id
         ORDER BY s.confirmed_at DESC`
      ),
    ]);

  const groups = groupsRes.rows;
  const students = studentsRes.rows;
  const assignments = assignmentsRes.rows;
  const submissions = submissionsRes.rows;

  const groupMap = new Map(groups.map((g) => [g.id, { ...g, members: [] }]));
  const studentGroupsMap = new Map(students.map((s) => [s.id, []]));

  for (const member of membersRes.rows) {
    const group = groupMap.get(member.groupId);
    if (group) {
      group.members.push({
        id: member.userId,
        name: member.name,
        email: member.email,
        studentId: member.studentId,
        roleInGroup: member.roleInGroup,
        joinedAt: member.joinedAt,
      });
    }
    if (studentGroupsMap.has(member.userId) && group) {
      studentGroupsMap.get(member.userId).push({
        id: group.id,
        name: group.name,
        roleInGroup: member.roleInGroup,
      });
    }
  }

  const targetGroupsByAssignment = new Map();
  for (const target of targetsRes.rows) {
    if (!targetGroupsByAssignment.has(target.assignmentId)) {
      targetGroupsByAssignment.set(target.assignmentId, []);
    }
    targetGroupsByAssignment.get(target.assignmentId).push({
      id: target.groupId,
      name: target.groupName,
    });
  }

  const groupSubmissionMap = new Map();
  const individualSubmissionMap = new Map();
  for (const sub of submissions) {
    if (sub.groupId !== null) {
      groupSubmissionMap.set(`${sub.assignmentId}:${sub.groupId}`, sub);
    } else {
      individualSubmissionMap.set(`${sub.assignmentId}:${sub.confirmedBy}`, sub);
    }
  }

  return {
    groups: Array.from(groupMap.values()),
    groupMap,
    students,
    studentGroupsMap,
    assignments,
    targetGroupsByAssignment,
    submissions,
    groupSubmissionMap,
    individualSubmissionMap,
  };
}

function getEligibleGroupsForAssignment(assignment, snapshot) {
  if (assignment.targetType === 'all') {
    return snapshot.groups;
  }
  const targets = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
  return targets
    .map((t) => snapshot.groupMap.get(t.id))
    .filter(Boolean);
}

function getEligibleStudentsForAssignment(assignment, snapshot) {
  if (assignment.targetType === 'all') {
    return snapshot.students;
  }
  const targetGroupIds = new Set(
    (snapshot.targetGroupsByAssignment.get(assignment.id) || []).map((t) => t.id)
  );
  return snapshot.students.filter((student) => {
    const groups = snapshot.studentGroupsMap.get(student.id) || [];
    return groups.some((g) => targetGroupIds.has(g.id));
  });
}

function evaluateStudentAssignmentStatus(assignment, student, snapshot) {
  const allStudentGroups = snapshot.studentGroupsMap.get(student.id) || [];
  const targetGroupIds = new Set(
    (snapshot.targetGroupsByAssignment.get(assignment.id) || []).map((t) => t.id)
  );

  const applicableGroups =
    assignment.targetType === 'all'
      ? allStudentGroups
      : allStudentGroups.filter((g) => targetGroupIds.has(g.id));

  const now = new Date();
  const isPastDue = new Date(assignment.dueDate) < now;

  if (applicableGroups.length > 0) {
    const groupStatuses = applicableGroups.map((group) => {
      const sub = snapshot.groupSubmissionMap.get(`${assignment.id}:${group.id}`) || null;
      return {
        groupId: group.id,
        groupName: group.name,
        submitted: Boolean(sub),
        submission: sub
          ? {
              id: sub.id,
              groupId: sub.groupId,
              groupName: sub.groupName,
              confirmedBy: sub.confirmedBy,
              confirmedByName: sub.confirmedByName,
              confirmedByStudentId: sub.confirmedByStudentId,
              confirmedAt: sub.confirmedAt,
              note: sub.note,
            }
          : null,
      };
    });

    const submittedCount = groupStatuses.filter((g) => g.submitted).length;
    let status = 'pending';
    if (submittedCount === groupStatuses.length) {
      status = 'submitted';
    } else if (submittedCount > 0) {
      status = 'partial';
    }

    const latestSub = groupStatuses
      .map((g) => g.submission)
      .filter(Boolean)
      .sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt))[0] || null;

    return {
      applicableGroups,
      groupStatuses,
      individualSubmission: null,
      status,
      isOverdue: status !== 'submitted' && isPastDue,
      canSubmit: submittedCount < groupStatuses.length,
      latestSubmission: latestSub,
    };
  }

  const individualSub =
    snapshot.individualSubmissionMap.get(`${assignment.id}:${student.id}`) || null;
  const status = individualSub ? 'submitted' : 'pending';

  return {
    applicableGroups: [],
    groupStatuses: [],
    individualSubmission: individualSub
      ? {
          id: individualSub.id,
          groupId: null,
          groupName: null,
          confirmedBy: individualSub.confirmedBy,
          confirmedByName: individualSub.confirmedByName,
          confirmedByStudentId: individualSub.confirmedByStudentId,
          confirmedAt: individualSub.confirmedAt,
          note: individualSub.note,
        }
      : null,
    status,
    isOverdue: status !== 'submitted' && isPastDue,
    canSubmit: !individualSub,
    latestSubmission: individualSub,
  };
}

function buildAdminAnalyticsAndTracking(snapshot) {
  const now = new Date();
  const groupWise = [];
  const studentWise = [];
  const perAssignment = [];

  for (const assignment of snapshot.assignments) {
    const eligibleGroups = getEligibleGroupsForAssignment(assignment, snapshot);
    const eligibleStudents = getEligibleStudentsForAssignment(assignment, snapshot);
    const isPastDue = new Date(assignment.dueDate) < now;

    let submittedGroupsCount = 0;
    for (const group of eligibleGroups) {
      const sub = snapshot.groupSubmissionMap.get(`${assignment.id}:${group.id}`) || null;
      const submitted = Boolean(sub);
      if (submitted) submittedGroupsCount += 1;

      groupWise.push({
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        dueDate: assignment.dueDate,
        targetType: assignment.targetType,
        groupId: group.id,
        groupName: group.name,
        memberCount: group.members.length,
        members: group.members.map((m) => ({
          id: m.id,
          name: m.name,
          studentId: m.studentId,
        })),
        status: submitted ? 'submitted' : 'pending',
        isOverdue: !submitted && isPastDue,
        confirmedBy: sub ? sub.confirmedBy : null,
        confirmedByName: sub ? sub.confirmedByName : null,
        confirmedByStudentId: sub ? sub.confirmedByStudentId : null,
        confirmedAt: sub ? sub.confirmedAt : null,
        note: sub ? sub.note : '',
      });
    }

    let submittedStudentsCount = 0;
    for (const student of eligibleStudents) {
      const evalResult = evaluateStudentAssignmentStatus(assignment, student, snapshot);
      if (evalResult.status === 'submitted') {
        submittedStudentsCount += 1;
      }

      studentWise.push({
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        dueDate: assignment.dueDate,
        targetType: assignment.targetType,
        studentId: student.id,
        studentCode: student.studentId,
        studentName: student.name,
        studentEmail: student.email,
        applicableGroups: evalResult.applicableGroups.map((g) => ({ id: g.id, name: g.name })),
        groupStatuses: evalResult.groupStatuses,
        status: evalResult.status,
        isOverdue: evalResult.isOverdue,
        confirmedByName: evalResult.latestSubmission ? evalResult.latestSubmission.confirmedByName : null,
        confirmedAt: evalResult.latestSubmission ? evalResult.latestSubmission.confirmedAt : null,
        note: evalResult.latestSubmission ? evalResult.latestSubmission.note : '',
      });
    }

    const shortTitle =
      assignment.title.length > 26 ? `${assignment.title.slice(0, 24)}...` : assignment.title;

    perAssignment.push({
      assignmentId: assignment.id,
      title: assignment.title,
      shortTitle,
      targetType: assignment.targetType,
      dueDate: assignment.dueDate,
      isOverdue: isPastDue,
      eligibleGroups: eligibleGroups.length,
      submittedGroups: submittedGroupsCount,
      groupCompletionRate:
        eligibleGroups.length > 0
          ? Math.round((submittedGroupsCount / eligibleGroups.length) * 100)
          : 0,
      eligibleStudents: eligibleStudents.length,
      submittedStudents: submittedStudentsCount,
      studentCompletionRate:
        eligibleStudents.length > 0
          ? Math.round((submittedStudentsCount / eligibleStudents.length) * 100)
          : 0,
    });
  }

  const perGroup = snapshot.groups.map((group) => {
    const applicableAssignments = snapshot.assignments.filter((assignment) => {
      if (assignment.targetType === 'all') return true;
      const targets = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
      return targets.some((t) => t.id === group.id);
    });

    const completedAssignments = applicableAssignments.filter((assignment) =>
      snapshot.groupSubmissionMap.has(`${assignment.id}:${group.id}`)
    ).length;

    const total = applicableAssignments.length;
    return {
      groupId: group.id,
      groupName: group.name,
      shortName: group.name.length > 22 ? `${group.name.slice(0, 20)}...` : group.name,
      memberCount: group.members.length,
      totalAssignments: total,
      completedAssignments,
      pendingAssignments: total - completedAssignments,
      completionRate: total > 0 ? Math.round((completedAssignments / total) * 100) : 0,
    };
  });

  const totalGroupSlots = groupWise.length;
  const completedGroupSlots = groupWise.filter((row) => row.status === 'submitted').length;
  const totalStudentSlots = studentWise.length;
  const completedStudentSlots = studentWise.filter((row) => row.status === 'submitted').length;
  const overduePendingCount = groupWise.filter((row) => row.isOverdue).length;

  const summary = {
    totalAssignments: snapshot.assignments.length,
    totalStudents: snapshot.students.length,
    totalGroups: snapshot.groups.length,
    totalGroupSlots,
    completedGroupSlots,
    overallGroupCompletionRate:
      totalGroupSlots > 0 ? Math.round((completedGroupSlots / totalGroupSlots) * 100) : 0,
    totalStudentSlots,
    completedStudentSlots,
    overallStudentCompletionRate:
      totalStudentSlots > 0 ? Math.round((completedStudentSlots / totalStudentSlots) * 100) : 0,
    overduePendingCount,
  };

  const recentActivity = snapshot.submissions.slice(0, 8).map((sub) => {
    const assignment = snapshot.assignments.find((a) => a.id === sub.assignmentId);
    return {
      id: sub.id,
      assignmentId: sub.assignmentId,
      assignmentTitle: assignment ? assignment.title : `Assignment #${sub.assignmentId}`,
      groupId: sub.groupId,
      groupName: sub.groupName || 'Individual Submission',
      confirmedByName: sub.confirmedByName,
      confirmedByStudentId: sub.confirmedByStudentId,
      confirmedAt: sub.confirmedAt,
      note: sub.note,
    };
  });

  return {
    summary,
    perAssignment,
    perGroup,
    groupWise,
    studentWise,
    recentActivity,
  };
}

module.exports = {
  loadTrackingSnapshot,
  getEligibleGroupsForAssignment,
  getEligibleStudentsForAssignment,
  evaluateStudentAssignmentStatus,
  buildAdminAnalyticsAndTracking,
};
