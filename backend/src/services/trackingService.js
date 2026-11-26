const { query } = require('../config/db');

async function loadTrackingSnapshot() {
  const [
    coursesRes,
    enrollmentsRes,
    groupsRes,
    membersRes,
    studentsRes,
    assignmentsRes,
    targetsRes,
    submissionsRes,
  ] = await Promise.all([
    query(
      `SELECT c.id, c.code, c.title, c.description, c.semester,
              c.accent_color AS "accentColor", c.professor_id AS "professorId",
              c.created_at AS "createdAt", u.name AS "professorName"
       FROM courses c
       JOIN users u ON u.id = c.professor_id
       ORDER BY c.code ASC, c.id ASC`
    ),
    query(
      `SELECT course_id AS "courseId", student_id AS "studentId", enrolled_at AS "enrolledAt"
       FROM course_enrollments`
    ),
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
      `SELECT a.id, a.course_id AS "courseId", c.code AS "courseCode", c.title AS "courseTitle",
              c.accent_color AS "courseAccentColor",
              a.title, a.description, a.due_date AS "dueDate", a.onedrive_link AS "onedriveLink",
              a.target_type AS "targetType", a.submission_type AS "submissionType",
              a.created_by AS "createdBy", a.created_at AS "createdAt", a.updated_at AS "updatedAt",
              u.name AS "createdByName"
       FROM assignments a
       JOIN users u ON u.id = a.created_by
       LEFT JOIN courses c ON c.id = a.course_id
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

  const courses = coursesRes.rows;
  const groups = groupsRes.rows;
  const students = studentsRes.rows;
  const assignments = assignmentsRes.rows;
  const submissions = submissionsRes.rows;

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const enrolledStudentIdsByCourse = new Map(courses.map((c) => [c.id, new Set()]));
  const enrolledCoursesByStudent = new Map(students.map((s) => [s.id, []]));

  for (const enrollment of enrollmentsRes.rows) {
    if (enrolledStudentIdsByCourse.has(enrollment.courseId)) {
      enrolledStudentIdsByCourse.get(enrollment.courseId).add(enrollment.studentId);
    }
    if (enrolledCoursesByStudent.has(enrollment.studentId)) {
      enrolledCoursesByStudent.get(enrollment.studentId).push({
        courseId: enrollment.courseId,
        enrolledAt: enrollment.enrolledAt,
      });
    }
  }

  const groupMap = new Map(groups.map((g) => [g.id, { ...g, members: [], leader: null }]));
  const studentGroupsMap = new Map(students.map((s) => [s.id, []]));

  for (const member of membersRes.rows) {
    const group = groupMap.get(member.groupId);
    if (group) {
      const memberRecord = {
        id: member.userId,
        name: member.name,
        email: member.email,
        studentId: member.studentId,
        roleInGroup: member.roleInGroup,
        joinedAt: member.joinedAt,
      };
      group.members.push(memberRecord);
      if (member.roleInGroup === 'leader' && !group.leader) {
        group.leader = memberRecord;
      }
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
    courses,
    courseMap,
    enrolledStudentIdsByCourse,
    enrolledCoursesByStudent,
    groups: Array.from(groupMap.values()),
    groupMap,
    students,
    studentMap: new Map(students.map((s) => [s.id, s])),
    studentGroupsMap,
    assignments,
    targetGroupsByAssignment,
    submissions,
    groupSubmissionMap,
    individualSubmissionMap,
  };
}

function isStudentVisibleForAssignment(assignment, studentId, snapshot) {
  if (assignment.courseId !== null && assignment.courseId !== undefined) {
    const enrolledSet = snapshot.enrolledStudentIdsByCourse.get(assignment.courseId);
    if (!enrolledSet || !enrolledSet.has(studentId)) {
      return false;
    }
  }

  if (assignment.submissionType === 'individual' || assignment.targetType === 'all') {
    return true;
  }

  const studentGroups = snapshot.studentGroupsMap.get(studentId) || [];
  const targets = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
  const studentGroupIds = new Set(studentGroups.map((g) => g.id));
  return targets.some((t) => studentGroupIds.has(t.id));
}

function getEligibleGroupsForAssignment(assignment, snapshot) {
  if (assignment.submissionType === 'individual') {
    return [];
  }

  if (assignment.targetType === 'specific_groups') {
    const targets = snapshot.targetGroupsByAssignment.get(assignment.id) || [];
    return targets
      .map((t) => snapshot.groupMap.get(t.id))
      .filter(Boolean);
  }

  if (assignment.courseId !== null && assignment.courseId !== undefined) {
    const enrolledSet = snapshot.enrolledStudentIdsByCourse.get(assignment.courseId);
    if (enrolledSet) {
      return snapshot.groups.filter((group) =>
        group.members.some((m) => enrolledSet.has(m.id))
      );
    }
  }

  return snapshot.groups;
}

function getEligibleStudentsForAssignment(assignment, snapshot) {
  return snapshot.students.filter((student) =>
    isStudentVisibleForAssignment(assignment, student.id, snapshot)
  );
}

function formatSubmissionSummary(sub) {
  if (!sub) return null;
  return {
    id: sub.id,
    groupId: sub.groupId,
    groupName: sub.groupName,
    confirmedBy: sub.confirmedBy,
    confirmedByName: sub.confirmedByName,
    confirmedByStudentId: sub.confirmedByStudentId,
    confirmedAt: sub.confirmedAt,
    note: sub.note,
  };
}

function evaluateStudentAssignmentStatus(assignment, student, snapshot) {
  const now = new Date();
  const isPastDue = new Date(assignment.dueDate) < now;

  if (assignment.submissionType === 'individual') {
    const individualSub =
      snapshot.individualSubmissionMap.get(`${assignment.id}:${student.id}`) || null;
    const status = individualSub ? 'submitted' : 'pending';

    return {
      submissionType: 'individual',
      applicableGroups: [],
      groupStatuses: [],
      individualSubmission: formatSubmissionSummary(individualSub),
      status,
      isOverdue: status !== 'submitted' && isPastDue,
      canSubmit: !individualSub,
      hasLeaderAccess: false,
      isUngrouped: false,
      latestSubmission: formatSubmissionSummary(individualSub),
    };
  }

  const allStudentGroups = snapshot.studentGroupsMap.get(student.id) || [];
  const targetGroupIds = new Set(
    (snapshot.targetGroupsByAssignment.get(assignment.id) || []).map((t) => t.id)
  );

  const matchingGroups =
    assignment.targetType === 'all'
      ? allStudentGroups
      : allStudentGroups.filter((g) => targetGroupIds.has(g.id));

  if (matchingGroups.length === 0) {
    return {
      submissionType: 'group',
      applicableGroups: [],
      groupStatuses: [],
      individualSubmission: null,
      status: 'pending',
      isOverdue: isPastDue,
      canSubmit: false,
      hasLeaderAccess: false,
      isUngrouped: true,
      latestSubmission: null,
    };
  }

  const applicableGroups = matchingGroups.map((group) => {
    const fullGroup = snapshot.groupMap.get(group.id);
    const leader = fullGroup?.leader || null;
    return {
      id: group.id,
      name: group.name,
      roleInGroup: group.roleInGroup,
      isLeader: group.roleInGroup === 'leader',
      leaderId: leader ? leader.id : null,
      leaderName: leader ? leader.name : null,
    };
  });

  const groupStatuses = applicableGroups.map((group) => {
    const sub = snapshot.groupSubmissionMap.get(`${assignment.id}:${group.id}`) || null;
    return {
      groupId: group.id,
      groupName: group.name,
      roleInGroup: group.roleInGroup,
      isLeader: group.isLeader,
      leaderId: group.leaderId,
      leaderName: group.leaderName,
      submitted: Boolean(sub),
      submission: formatSubmissionSummary(sub),
    };
  });

  const submittedCount = groupStatuses.filter((g) => g.submitted).length;
  let status = 'pending';
  if (submittedCount === groupStatuses.length) {
    status = 'submitted';
  } else if (submittedCount > 0) {
    status = 'partial';
  }

  const hasLeaderAccess = groupStatuses.some((g) => !g.submitted && g.isLeader);
  const latestSub =
    groupStatuses
      .map((g) => g.submission)
      .filter(Boolean)
      .sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt))[0] || null;

  return {
    submissionType: 'group',
    applicableGroups,
    groupStatuses,
    individualSubmission: null,
    status,
    isOverdue: status !== 'submitted' && isPastDue,
    canSubmit: hasLeaderAccess,
    hasLeaderAccess,
    isUngrouped: false,
    latestSubmission: latestSub,
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
        courseId: assignment.courseId,
        courseCode: assignment.courseCode || null,
        courseTitle: assignment.courseTitle || null,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        submissionType: assignment.submissionType,
        dueDate: assignment.dueDate,
        targetType: assignment.targetType,
        groupId: group.id,
        groupName: group.name,
        leaderName: group.leader ? group.leader.name : null,
        memberCount: group.members.length,
        members: group.members.map((m) => ({
          id: m.id,
          name: m.name,
          studentId: m.studentId,
          roleInGroup: m.roleInGroup,
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
        courseId: assignment.courseId,
        courseCode: assignment.courseCode || null,
        courseTitle: assignment.courseTitle || null,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        submissionType: assignment.submissionType,
        dueDate: assignment.dueDate,
        targetType: assignment.targetType,
        studentId: student.id,
        studentCode: student.studentId,
        studentName: student.name,
        studentEmail: student.email,
        applicableGroups: evalResult.applicableGroups.map((g) => ({
          id: g.id,
          name: g.name,
          isLeader: g.isLeader,
          leaderName: g.leaderName,
        })),
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

    const groupCompletionRate =
      eligibleGroups.length > 0
        ? Math.round((submittedGroupsCount / eligibleGroups.length) * 100)
        : 0;
    const studentCompletionRate =
      eligibleStudents.length > 0
        ? Math.round((submittedStudentsCount / eligibleStudents.length) * 100)
        : 0;

    const totalSlots =
      assignment.submissionType === 'group' ? eligibleGroups.length : eligibleStudents.length;
    const completedSlots =
      assignment.submissionType === 'group' ? submittedGroupsCount : submittedStudentsCount;

    perAssignment.push({
      assignmentId: assignment.id,
      courseId: assignment.courseId,
      courseCode: assignment.courseCode || null,
      courseTitle: assignment.courseTitle || null,
      title: assignment.title,
      shortTitle,
      targetType: assignment.targetType,
      submissionType: assignment.submissionType,
      dueDate: assignment.dueDate,
      isOverdue: isPastDue,
      eligibleGroups: eligibleGroups.length,
      submittedGroups: submittedGroupsCount,
      groupCompletionRate,
      eligibleStudents: eligibleStudents.length,
      submittedStudents: submittedStudentsCount,
      studentCompletionRate,
      totalSlots,
      completedSlots,
      completionRate: totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
    });
  }

  const perGroup = snapshot.groups.map((group) => {
    const applicableAssignments = snapshot.assignments.filter((assignment) => {
      if (assignment.submissionType !== 'group') return false;
      if (assignment.targetType === 'all') {
        if (assignment.courseId !== null && assignment.courseId !== undefined) {
          const enrolledSet = snapshot.enrolledStudentIdsByCourse.get(assignment.courseId);
          return enrolledSet ? group.members.some((m) => enrolledSet.has(m.id)) : true;
        }
        return true;
      }
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
  const overduePendingCount =
    groupWise.filter((row) => row.isOverdue).length +
    studentWise.filter((row) => row.submissionType === 'individual' && row.isOverdue).length;

  const summary = {
    totalCourses: snapshot.courses.length,
    totalAssignments: snapshot.assignments.length,
    individualAssignments: snapshot.assignments.filter((a) => a.submissionType === 'individual')
      .length,
    groupAssignments: snapshot.assignments.filter((a) => a.submissionType === 'group').length,
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
      courseCode: assignment?.courseCode || null,
      submissionType: assignment?.submissionType || (sub.groupId ? 'group' : 'individual'),
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

function buildStudentCoursesSummary(student, snapshot) {
  const enrolledRecords = snapshot.enrolledCoursesByStudent.get(student.id) || [];
  const enrolledMap = new Map(enrolledRecords.map((e) => [e.courseId, e.enrolledAt]));

  return snapshot.courses
    .filter((course) => enrolledMap.has(course.id))
    .map((course) => {
      const courseAssignments = snapshot.assignments.filter(
        (a) => a.courseId === course.id && isStudentVisibleForAssignment(a, student.id, snapshot)
      );

      let completedAssignments = 0;
      let partialAssignments = 0;
      let pendingAssignments = 0;
      let overdueAssignments = 0;
      let individualCount = 0;
      let individualCompletedCount = 0;
      let groupCount = 0;
      let groupCompletedCount = 0;

      for (const assignment of courseAssignments) {
        const evalResult = evaluateStudentAssignmentStatus(assignment, student, snapshot);
        if (evalResult.status === 'submitted') completedAssignments += 1;
        else if (evalResult.status === 'partial') partialAssignments += 1;
        else pendingAssignments += 1;

        if (evalResult.isOverdue) overdueAssignments += 1;

        if (assignment.submissionType === 'individual') {
          individualCount += 1;
          if (evalResult.status === 'submitted') individualCompletedCount += 1;
        } else {
          groupCount += 1;
          if (evalResult.status === 'submitted') groupCompletedCount += 1;
        }
      }

      const totalAssignments = courseAssignments.length;
      return {
        ...course,
        enrolledAt: enrolledMap.get(course.id),
        totalAssignments,
        completedAssignments,
        partialAssignments,
        pendingAssignments,
        overdueAssignments,
        individualCount,
        individualCompletedCount,
        groupCount,
        groupCompletedCount,
        completionRate:
          totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0,
      };
    });
}

function buildAdminCoursesSummary(snapshot, professorId = null) {
  const { perAssignment } = buildAdminAnalyticsAndTracking(snapshot);
  const statsByAssignmentId = new Map(perAssignment.map((a) => [a.assignmentId, a]));

  const visibleCourses =
    professorId !== null
      ? snapshot.courses.filter((c) => c.professorId === professorId)
      : snapshot.courses;

  return visibleCourses.map((course) => {
    const enrolledSet = snapshot.enrolledStudentIdsByCourse.get(course.id) || new Set();
    const courseAssignments = snapshot.assignments.filter((a) => a.courseId === course.id);

    let totalSlots = 0;
    let submittedSlots = 0;
    let individualCount = 0;
    let groupCount = 0;

    for (const assignment of courseAssignments) {
      if (assignment.submissionType === 'individual') individualCount += 1;
      else groupCount += 1;

      const stat = statsByAssignmentId.get(assignment.id);
      if (stat) {
        totalSlots += stat.totalSlots;
        submittedSlots += stat.completedSlots;
      }
    }

    const pendingSlots = Math.max(0, totalSlots - submittedSlots);

    return {
      ...course,
      studentCount: enrolledSet.size,
      assignmentCount: courseAssignments.length,
      individualCount,
      groupCount,
      totalSlots,
      submittedCount: submittedSlots,
      pendingCount: pendingSlots,
      completionRate: totalSlots > 0 ? Math.round((submittedSlots / totalSlots) * 100) : 0,
    };
  });
}

module.exports = {
  loadTrackingSnapshot,
  isStudentVisibleForAssignment,
  getEligibleGroupsForAssignment,
  getEligibleStudentsForAssignment,
  evaluateStudentAssignmentStatus,
  buildAdminAnalyticsAndTracking,
  buildStudentCoursesSummary,
  buildAdminCoursesSummary,
};
