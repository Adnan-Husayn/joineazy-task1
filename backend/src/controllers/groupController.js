const { query, withTransaction } = require('../config/db');
const { AppError, asyncHandler, parseId } = require('../utils/errors');
const { createGroupSchema, addMemberSchema } = require('../validators/schemas');
const {
  loadTrackingSnapshot,
  buildAdminAnalyticsAndTracking,
} = require('../services/trackingService');

function formatGroupFromSnapshot(group, perGroupStatsMap, currentUserId) {
  const stats = perGroupStatsMap.get(group.id) || {
    totalAssignments: 0,
    completedAssignments: 0,
    pendingAssignments: 0,
    completionRate: 0,
  };
  const currentMembership = group.members.find((m) => m.id === currentUserId);

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    createdBy: group.createdBy,
    createdByName: group.createdByName,
    createdAt: group.createdAt,
    memberCount: group.members.length,
    roleInGroup: currentMembership ? currentMembership.roleInGroup : null,
    members: group.members,
    stats: {
      totalAssignments: stats.totalAssignments,
      completedAssignments: stats.completedAssignments,
      pendingAssignments: stats.pendingAssignments,
      completionRate: stats.completionRate,
    },
  };
}

const listGroups = asyncHandler(async (req, res) => {
  const snapshot = await loadTrackingSnapshot();
  const { perGroup } = buildAdminAnalyticsAndTracking(snapshot);
  const perGroupStatsMap = new Map(perGroup.map((g) => [g.groupId, g]));

  const visibleGroups =
    req.user.role === 'admin'
      ? snapshot.groups
      : snapshot.groups.filter((group) => group.members.some((m) => m.id === req.user.id));

  const groups = visibleGroups.map((group) =>
    formatGroupFromSnapshot(group, perGroupStatsMap, req.user.id)
  );

  res.status(200).json({ groups });
});

const getGroupById = asyncHandler(async (req, res) => {
  const groupId = parseId(req.params.id, 'group ID');
  const snapshot = await loadTrackingSnapshot();
  const group = snapshot.groupMap.get(groupId);

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  if (req.user.role === 'student' && !group.members.some((m) => m.id === req.user.id)) {
    throw new AppError('You are not a member of this group', 403);
  }

  const { perGroup } = buildAdminAnalyticsAndTracking(snapshot);
  const perGroupStatsMap = new Map(perGroup.map((g) => [g.groupId, g]));

  res.status(200).json({
    group: formatGroupFromSnapshot(group, perGroupStatsMap, req.user.id),
  });
});

const createGroup = asyncHandler(async (req, res) => {
  const parsed = createGroupSchema.parse(req.body);

  const createdGroupId = await withTransaction(async (client) => {
    const groupRes = await client.query(
      `INSERT INTO groups (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [parsed.name, parsed.description || '', req.user.id]
    );
    const groupId = groupRes.rows[0].id;

    if (req.user.role === 'student') {
      await client.query(
        `INSERT INTO group_members (group_id, user_id, role_in_group)
         VALUES ($1, $2, 'leader')`,
        [groupId, req.user.id]
      );
    }

    const seenIdentifiers = new Set();
    for (const rawIdentifier of parsed.memberIdentifiers || []) {
      const identifier = rawIdentifier.trim();
      const key = identifier.toLowerCase();
      if (!identifier || seenIdentifiers.has(key)) continue;
      seenIdentifiers.add(key);

      const userRes = await client.query(
        `SELECT id, role
         FROM users
         WHERE LOWER(email) = LOWER($1) OR LOWER(student_id) = LOWER($1)
         LIMIT 1`,
        [identifier]
      );

      if (userRes.rows.length === 0) {
        throw new AppError(`No student found for "${identifier}"`, 400);
      }

      const member = userRes.rows[0];
      if (member.role !== 'student') {
        throw new AppError(`"${identifier}" is not a student account`, 400);
      }

      await client.query(
        `INSERT INTO group_members (group_id, user_id, role_in_group)
         VALUES ($1, $2, 'member')
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [groupId, member.id]
      );
    }

    return groupId;
  });

  const snapshot = await loadTrackingSnapshot();
  const { perGroup } = buildAdminAnalyticsAndTracking(snapshot);
  const perGroupStatsMap = new Map(perGroup.map((g) => [g.groupId, g]));
  const group = snapshot.groupMap.get(createdGroupId);

  res.status(201).json({
    group: formatGroupFromSnapshot(group, perGroupStatsMap, req.user.id),
  });
});

const addMember = asyncHandler(async (req, res) => {
  const groupId = parseId(req.params.id, 'group ID');
  const parsed = addMemberSchema.parse(req.body);
  const identifier = parsed.identifier.trim();

  const groupCheck = await query('SELECT id, name FROM groups WHERE id = $1', [groupId]);
  if (groupCheck.rows.length === 0) {
    throw new AppError('Group not found', 404);
  }

  if (req.user.role === 'student') {
    const membershipCheck = await query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    if (membershipCheck.rows.length === 0) {
      throw new AppError('Only group members can add peers to this group', 403);
    }
  }

  const userRes = await query(
    `SELECT id, name, email, student_id AS "studentId", role
     FROM users
     WHERE LOWER(email) = LOWER($1) OR LOWER(student_id) = LOWER($1)
     LIMIT 1`,
    [identifier]
  );

  if (userRes.rows.length === 0) {
    throw new AppError('No student found matching that email or Student ID', 404);
  }

  const targetUser = userRes.rows[0];
  if (targetUser.role !== 'student') {
    throw new AppError('Only student accounts can be added to a group', 400);
  }

  const existingMember = await query(
    'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, targetUser.id]
  );
  if (existingMember.rows.length > 0) {
    throw new AppError(`${targetUser.name} is already a member of this group`, 409);
  }

  await query(
    `INSERT INTO group_members (group_id, user_id, role_in_group)
     VALUES ($1, $2, 'member')`,
    [groupId, targetUser.id]
  );

  const snapshot = await loadTrackingSnapshot();
  const { perGroup } = buildAdminAnalyticsAndTracking(snapshot);
  const perGroupStatsMap = new Map(perGroup.map((g) => [g.groupId, g]));
  const updatedGroup = snapshot.groupMap.get(groupId);

  res.status(201).json({
    message: `${targetUser.name} added to ${groupCheck.rows[0].name}`,
    group: formatGroupFromSnapshot(updatedGroup, perGroupStatsMap, req.user.id),
  });
});

const removeMember = asyncHandler(async (req, res) => {
  const groupId = parseId(req.params.id, 'group ID');
  const targetUserId = parseId(req.params.userId, 'user ID');

  const outcome = await withTransaction(async (client) => {
    const groupRes = await client.query('SELECT id, name FROM groups WHERE id = $1', [groupId]);
    if (groupRes.rows.length === 0) {
      throw new AppError('Group not found', 404);
    }

    const targetRes = await client.query(
      `SELECT id, role_in_group AS "roleInGroup"
       FROM group_members
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, targetUserId]
    );
    if (targetRes.rows.length === 0) {
      throw new AppError('User is not a member of this group', 404);
    }

    if (req.user.role !== 'admin' && req.user.id !== targetUserId) {
      const requesterRes = await client.query(
        `SELECT role_in_group AS "roleInGroup"
         FROM group_members
         WHERE group_id = $1 AND user_id = $2`,
        [groupId, req.user.id]
      );
      if (
        requesterRes.rows.length === 0 ||
        requesterRes.rows[0].roleInGroup !== 'leader'
      ) {
        throw new AppError('Only the group leader or a professor can remove other members', 403);
      }
    }

    await client.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [
      groupId,
      targetUserId,
    ]);

    const remainingRes = await client.query(
      `SELECT id, user_id AS "userId", role_in_group AS "roleInGroup"
       FROM group_members
       WHERE group_id = $1
       ORDER BY joined_at ASC, id ASC`,
      [groupId]
    );

    if (remainingRes.rows.length === 0) {
      await client.query('DELETE FROM groups WHERE id = $1', [groupId]);
      return {
        groupDeleted: true,
        message: 'You left the group. Because no members remained, the empty group was removed.',
      };
    }

    const hasLeader = remainingRes.rows.some((r) => r.roleInGroup === 'leader');
    if (!hasLeader) {
      await client.query(`UPDATE group_members SET role_in_group = 'leader' WHERE id = $1`, [
        remainingRes.rows[0].id,
      ]);
    }

    return {
      groupDeleted: false,
      message:
        req.user.id === targetUserId
          ? 'You have left the group'
          : 'Member removed from the group',
    };
  });

  if (outcome.groupDeleted) {
    return res.status(200).json(outcome);
  }

  const snapshot = await loadTrackingSnapshot();
  const { perGroup } = buildAdminAnalyticsAndTracking(snapshot);
  const perGroupStatsMap = new Map(perGroup.map((g) => [g.groupId, g]));
  const updatedGroup = snapshot.groupMap.get(groupId);

  return res.status(200).json({
    ...outcome,
    group: formatGroupFromSnapshot(updatedGroup, perGroupStatsMap, req.user.id),
  });
});

const deleteGroup = asyncHandler(async (req, res) => {
  const groupId = parseId(req.params.id, 'group ID');

  const groupRes = await query('SELECT id FROM groups WHERE id = $1', [groupId]);
  if (groupRes.rows.length === 0) {
    throw new AppError('Group not found', 404);
  }

  if (req.user.role !== 'admin') {
    const memberRes = await query(
      `SELECT role_in_group AS "roleInGroup"
       FROM group_members
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.user.id]
    );
    if (memberRes.rows.length === 0 || memberRes.rows[0].roleInGroup !== 'leader') {
      throw new AppError('Only the group leader or a professor can delete this group', 403);
    }
  }

  await query('DELETE FROM groups WHERE id = $1', [groupId]);
  res.status(200).json({ message: 'Group deleted successfully' });
});

module.exports = {
  listGroups,
  getGroupById,
  createGroup,
  addMember,
  removeMember,
  deleteGroup,
};
