const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../config/db');
const { initDatabase } = require('./init');

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function addHours(baseDate, hours) {
  const date = new Date(baseDate);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

async function ensureUser(client, { name, email, studentId, passwordHash, role }) {
  const normalizedEmail = email.toLowerCase();
  const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO users (name, email, student_id, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [name, normalizedEmail, studentId || null, passwordHash, role]
  );
  return inserted.rows[0].id;
}

async function ensureGroup(client, { name, description, createdBy }) {
  const existing = await client.query('SELECT id FROM groups WHERE name = $1 LIMIT 1', [name]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO groups (name, description, created_by)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [name, description, createdBy]
  );
  return inserted.rows[0].id;
}

async function ensureMember(client, { groupId, userId, roleInGroup }) {
  await client.query(
    `INSERT INTO group_members (group_id, user_id, role_in_group)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [groupId, userId, roleInGroup]
  );
}

async function ensureAssignment(client, { title, description, dueDate, onedriveLink, targetType, createdBy, targetGroupIds }) {
  const existing = await client.query('SELECT id FROM assignments WHERE title = $1 LIMIT 1', [title]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO assignments (title, description, due_date, onedrive_link, target_type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [title, description, dueDate, onedriveLink, targetType, createdBy]
  );
  const assignmentId = inserted.rows[0].id;

  if (targetType === 'specific_groups' && Array.isArray(targetGroupIds)) {
    for (const groupId of targetGroupIds) {
      await client.query(
        `INSERT INTO assignment_targets (assignment_id, group_id)
         VALUES ($1, $2)
         ON CONFLICT (assignment_id, group_id) DO NOTHING`,
        [assignmentId, groupId]
      );
    }
  }

  return assignmentId;
}

async function ensureSubmission(client, { assignmentId, groupId, confirmedBy, note, confirmedAt }) {
  await client.query(
    `INSERT INTO submissions (assignment_id, group_id, confirmed_by, confirmation_note, confirmed_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (assignment_id, group_id) WHERE group_id IS NOT NULL DO NOTHING`,
    [assignmentId, groupId, confirmedBy, note, confirmedAt]
  );
}

async function seedDatabase({ closePool = false } = {}) {
  await initDatabase();

  const adminHash = await bcrypt.hash('Admin@123', 10);
  const studentHash = await bcrypt.hash('Student@123', 10);
  const now = new Date();

  const result = await withTransaction(async (client) => {
    const profId = await ensureUser(client, {
      name: 'Prof. Arvind Sharma',
      email: 'prof.sharma@joineazy.edu',
      studentId: null,
      passwordHash: adminHash,
      role: 'admin',
    });

    const adnanId = await ensureUser(client, {
      name: 'Adnan Husain',
      email: 'adnan@joineazy.edu',
      studentId: 'STU-2026-001',
      passwordHash: studentHash,
      role: 'student',
    });

    const priyaId = await ensureUser(client, {
      name: 'Priya Nair',
      email: 'priya@joineazy.edu',
      studentId: 'STU-2026-002',
      passwordHash: studentHash,
      role: 'student',
    });

    const rohanId = await ensureUser(client, {
      name: 'Rohan Verma',
      email: 'rohan@joineazy.edu',
      studentId: 'STU-2026-003',
      passwordHash: studentHash,
      role: 'student',
    });

    const meeraId = await ensureUser(client, {
      name: 'Meera Iyer',
      email: 'meera@joineazy.edu',
      studentId: 'STU-2026-004',
      passwordHash: studentHash,
      role: 'student',
    });

    const alphaGroupId = await ensureGroup(client, {
      name: 'Group Alpha - Distributed Systems',
      description: 'Systems engineering lab pair working on consensus and storage projects.',
      createdBy: adnanId,
    });

    const betaGroupId = await ensureGroup(client, {
      name: 'Group Beta - Data Engineering',
      description: 'Streaming pipelines, SQL indexing benchmarks, and analytics.',
      createdBy: rohanId,
    });

    const capstoneGroupId = await ensureGroup(client, {
      name: 'Capstone Core Team',
      description: 'Cross-functional semester capstone project group.',
      createdBy: adnanId,
    });

    await ensureMember(client, { groupId: alphaGroupId, userId: adnanId, roleInGroup: 'leader' });
    await ensureMember(client, { groupId: alphaGroupId, userId: priyaId, roleInGroup: 'member' });

    await ensureMember(client, { groupId: betaGroupId, userId: rohanId, roleInGroup: 'leader' });
    await ensureMember(client, { groupId: betaGroupId, userId: meeraId, roleInGroup: 'member' });

    await ensureMember(client, { groupId: capstoneGroupId, userId: adnanId, roleInGroup: 'leader' });
    await ensureMember(client, { groupId: capstoneGroupId, userId: rohanId, roleInGroup: 'member' });
    await ensureMember(client, { groupId: capstoneGroupId, userId: meeraId, roleInGroup: 'member' });

    const lab1Id = await ensureAssignment(client, {
      title: 'Lab 1: Raft Consensus Protocol Design Doc',
      description:
        'Submit a 4-page architecture report covering leader election timeouts, log replication invariants, and split-brain recovery scenarios. Upload PDF + diagram archive to the shared OneDrive folder.',
      dueDate: addDays(now, -2),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs401-lab1-raft',
      targetType: 'all',
      createdBy: profId,
      targetGroupIds: [],
    });

    const lab2Id = await ensureAssignment(client, {
      title: 'Assignment 2: PostgreSQL Query Optimizer Benchmark',
      description:
        'Compare sequential scans, B-Tree indexes, and composite partial indexes on a 1M-row dataset. Include EXPLAIN ANALYZE screenshots and query latency CSVs in OneDrive.',
      dueDate: addDays(now, 5),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs401-lab2-postgres',
      targetType: 'all',
      createdBy: profId,
      targetGroupIds: [],
    });

    const milestone1Id = await ensureAssignment(client, {
      title: 'Project Milestone 1: Event Stream Pipeline',
      description:
        'Implement an idempotent producer-consumer pipeline with dead-letter retry handling and throughput metrics. Upload repository zip and demo recording to OneDrive.',
      dueDate: addDays(now, 10),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs401-milestone1-stream',
      targetType: 'specific_groups',
      createdBy: profId,
      targetGroupIds: [alphaGroupId, betaGroupId],
    });

    await ensureAssignment(client, {
      title: 'Capstone Proposal & Architecture Review',
      description:
        'Finalize capstone problem statement, ER diagram, milestone breakdown, and evaluation metrics. Upload slide deck and spec document to OneDrive.',
      dueDate: addDays(now, 14),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs401-capstone-proposal',
      targetType: 'specific_groups',
      createdBy: profId,
      targetGroupIds: [capstoneGroupId],
    });

    await ensureSubmission(client, {
      assignmentId: lab1Id,
      groupId: alphaGroupId,
      confirmedBy: adnanId,
      note: 'Uploaded Raft_Design_GroupAlpha.pdf and state-machine diagrams.',
      confirmedAt: addHours(now, -72),
    });

    await ensureSubmission(client, {
      assignmentId: lab1Id,
      groupId: betaGroupId,
      confirmedBy: meeraId,
      note: 'Final PDF and TLA+ trace uploaded to Lab 1 OneDrive folder.',
      confirmedAt: addHours(now, -60),
    });

    await ensureSubmission(client, {
      assignmentId: lab2Id,
      groupId: alphaGroupId,
      confirmedBy: priyaId,
      note: 'Uploaded EXPLAIN ANALYZE report and CSV benchmark runs.',
      confirmedAt: addHours(now, -18),
    });

    await ensureSubmission(client, {
      assignmentId: milestone1Id,
      groupId: betaGroupId,
      confirmedBy: rohanId,
      note: 'Stream pipeline repo archive and latency video uploaded.',
      confirmedAt: addHours(now, -6),
    });

    return { usersSeeded: 5, groupsSeeded: 3, assignmentsSeeded: 4 };
  });

  if (closePool) {
    await pool.end();
  }

  return result;
}

if (require.main === module) {
  seedDatabase({ closePool: true })
    .then((summary) => {
      console.log('Seed completed:', summary);
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed failed:', err);
      await pool.end();
      process.exit(1);
    });
}

module.exports = { seedDatabase };
