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

async function ensureCourse(client, { code, title, description, semester, accentColor, professorId }) {
  const normalizedCode = code.trim().toUpperCase();
  const existing = await client.query('SELECT id FROM courses WHERE LOWER(code) = LOWER($1) LIMIT 1', [
    normalizedCode,
  ]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO courses (code, title, description, semester, accent_color, professor_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [normalizedCode, title, description, semester, accentColor, professorId]
  );
  return inserted.rows[0].id;
}

async function ensureCourseEnrollment(client, { courseId, studentId }) {
  await client.query(
    `INSERT INTO course_enrollments (course_id, student_id)
     VALUES ($1, $2)
     ON CONFLICT (course_id, student_id) DO NOTHING`,
    [courseId, studentId]
  );
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
     ON CONFLICT (group_id, user_id) DO UPDATE
       SET role_in_group = EXCLUDED.role_in_group`,
    [groupId, userId, roleInGroup]
  );
}

async function ensureAssignment(
  client,
  { courseId, title, description, dueDate, onedriveLink, targetType, submissionType, createdBy, targetGroupIds }
) {
  const existing = await client.query('SELECT id FROM assignments WHERE title = $1 LIMIT 1', [title]);
  let assignmentId;

  if (existing.rows.length > 0) {
    assignmentId = existing.rows[0].id;
    await client.query(
      `UPDATE assignments
       SET course_id = COALESCE(course_id, $1),
           submission_type = $2,
           target_type = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [courseId, submissionType, targetType, assignmentId]
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO assignments (course_id, title, description, due_date, onedrive_link, target_type, submission_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [courseId, title, description, dueDate, onedriveLink, targetType, submissionType, createdBy]
    );
    assignmentId = inserted.rows[0].id;
  }

  if (targetType === 'specific_groups' && Array.isArray(targetGroupIds)) {
    await client.query('DELETE FROM assignment_targets WHERE assignment_id = $1', [assignmentId]);
    for (const groupId of targetGroupIds) {
      await client.query(
        `INSERT INTO assignment_targets (assignment_id, group_id)
         VALUES ($1, $2)
         ON CONFLICT (assignment_id, group_id) DO NOTHING`,
        [assignmentId, groupId]
      );
    }
  } else {
    await client.query('DELETE FROM assignment_targets WHERE assignment_id = $1', [assignmentId]);
  }

  return assignmentId;
}

async function ensureGroupSubmission(client, { assignmentId, groupId, confirmedBy, note, confirmedAt }) {
  await client.query(
    `INSERT INTO submissions (assignment_id, group_id, confirmed_by, confirmation_note, confirmed_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (assignment_id, group_id) WHERE group_id IS NOT NULL DO UPDATE
       SET confirmed_by = EXCLUDED.confirmed_by`,
    [assignmentId, groupId, confirmedBy, note, confirmedAt]
  );
}

async function ensureIndividualSubmission(client, { assignmentId, confirmedBy, note, confirmedAt }) {
  await client.query(
    `INSERT INTO submissions (assignment_id, group_id, confirmed_by, confirmation_note, confirmed_at)
     VALUES ($1, NULL, $2, $3, $4)
     ON CONFLICT (assignment_id, confirmed_by) WHERE group_id IS NULL DO NOTHING`,
    [assignmentId, confirmedBy, note, confirmedAt]
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

    // Seed 4 realistic courses taught by Prof. Arvind Sharma
    const cs401Id = await ensureCourse(client, {
      code: 'CS401',
      title: 'Distributed Systems',
      description:
        'Consensus algorithms, replication protocols, fault tolerance, and distributed state management.',
      semester: 'Fall 2026',
      accentColor: 'indigo',
      professorId: profId,
    });

    const cs402Id = await ensureCourse(client, {
      code: 'CS402',
      title: 'Database Internals',
      description:
        'Storage engines, B+ Tree and LSM indexing, query optimization, and MVCC concurrency control.',
      semester: 'Fall 2026',
      accentColor: 'emerald',
      professorId: profId,
    });

    const cs403Id = await ensureCourse(client, {
      code: 'CS403',
      title: 'Full-Stack Web Architecture',
      description:
        'REST APIs, relational data modeling, authentication flows, and modern React interfaces.',
      semester: 'Fall 2026',
      accentColor: 'amber',
      professorId: profId,
    });

    const cs404Id = await ensureCourse(client, {
      code: 'CS404',
      title: 'Applied AI Systems',
      description:
        'Retrieval-augmented generation, evaluation harnesses, prompt pipelines, and inference optimization.',
      semester: 'Fall 2026',
      accentColor: 'violet',
      professorId: profId,
    });

    // Enroll all student accounts (demo students + any existing students on Round 1 upgrade)
    const allStudentsRes = await client.query(`SELECT id FROM users WHERE role = 'student'`);
    const courseIds = [cs401Id, cs402Id, cs403Id, cs404Id];
    for (const row of allStudentsRes.rows) {
      for (const courseId of courseIds) {
        await ensureCourseEnrollment(client, { courseId, studentId: row.id });
      }
    }

    // Ensure groups and Round 2 leader/member roles
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
      createdBy: priyaId,
    });

    // Group Alpha: Adnan = leader, Priya = member
    await ensureMember(client, { groupId: alphaGroupId, userId: adnanId, roleInGroup: 'leader' });
    await ensureMember(client, { groupId: alphaGroupId, userId: priyaId, roleInGroup: 'member' });

    // Group Beta: Rohan = leader, Meera = member
    await ensureMember(client, { groupId: betaGroupId, userId: rohanId, roleInGroup: 'leader' });
    await ensureMember(client, { groupId: betaGroupId, userId: meeraId, roleInGroup: 'member' });

    // Capstone Core Team: Priya = leader, Adnan/Rohan/Meera = members
    await ensureMember(client, { groupId: capstoneGroupId, userId: priyaId, roleInGroup: 'leader' });
    await ensureMember(client, { groupId: capstoneGroupId, userId: adnanId, roleInGroup: 'member' });
    await ensureMember(client, { groupId: capstoneGroupId, userId: rohanId, roleInGroup: 'member' });
    await ensureMember(client, { groupId: capstoneGroupId, userId: meeraId, roleInGroup: 'member' });

    // CS401 Assignments (1 group, 1 individual)
    const lab1Id = await ensureAssignment(client, {
      courseId: cs401Id,
      title: 'Lab 1: Raft Consensus Protocol Design Doc',
      description:
        'Submit a 4-page architecture report covering leader election timeouts, log replication invariants, and split-brain recovery scenarios. Upload PDF + diagram archive to the shared OneDrive folder.',
      dueDate: addDays(now, -2),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs401-lab1-raft',
      targetType: 'specific_groups',
      submissionType: 'group',
      createdBy: profId,
      targetGroupIds: [alphaGroupId, betaGroupId],
    });

    const cs401QuizId = await ensureAssignment(client, {
      courseId: cs401Id,
      title: 'Individual Quiz: Lamport Clocks & Vector Timestamps',
      description:
        'Complete the partial-order event trace worksheet and upload your annotated PDF to the CS401 OneDrive folder.',
      dueDate: addDays(now, 4),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs401-lamport-quiz',
      targetType: 'all',
      submissionType: 'individual',
      createdBy: profId,
      targetGroupIds: [],
    });

    // CS402 Assignments (1 group, 1 individual)
    const lab2Id = await ensureAssignment(client, {
      courseId: cs402Id,
      title: 'Assignment 2: PostgreSQL Query Optimizer Benchmark',
      description:
        'Compare sequential scans, B-Tree indexes, and composite partial indexes on a 1M-row dataset. Include EXPLAIN ANALYZE screenshots and query latency CSVs in OneDrive.',
      dueDate: addDays(now, 5),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs402-lab2-postgres',
      targetType: 'specific_groups',
      submissionType: 'group',
      createdBy: profId,
      targetGroupIds: [alphaGroupId, betaGroupId],
    });

    const cs402BtreeId = await ensureAssignment(client, {
      courseId: cs402Id,
      title: 'Individual Lab: B+ Tree Page Split Walkthrough',
      description:
        'Trace insertion of 20 keys into an order-4 B+ Tree and document leaf splits and parent pointer updates in a single PDF.',
      dueDate: addDays(now, 8),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs402-btree-walkthrough',
      targetType: 'all',
      submissionType: 'individual',
      createdBy: profId,
      targetGroupIds: [],
    });

    // CS403 Assignments (1 group, 1 individual)
    const milestone1Id = await ensureAssignment(client, {
      courseId: cs403Id,
      title: 'Project Milestone 1: Event Stream Pipeline',
      description:
        'Implement an idempotent producer-consumer pipeline with dead-letter retry handling and throughput metrics. Upload repository zip and demo recording to OneDrive.',
      dueDate: addDays(now, 10),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs403-milestone1-stream',
      targetType: 'specific_groups',
      submissionType: 'group',
      createdBy: profId,
      targetGroupIds: [alphaGroupId, betaGroupId],
    });

    const cs403RbacId = await ensureAssignment(client, {
      courseId: cs403Id,
      title: 'Individual Spec: REST API Auth & RBAC Checklist',
      description:
        'Document JWT validation, role guards, and 401/403 response contracts for your service endpoints and upload the markdown/PDF spec.',
      dueDate: addDays(now, 6),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs403-rbac-spec',
      targetType: 'all',
      submissionType: 'individual',
      createdBy: profId,
      targetGroupIds: [],
    });

    // CS404 Assignments (2 group for Capstone Core Team + 1 individual)
    const vectorBenchId = await ensureAssignment(client, {
      courseId: cs404Id,
      title: 'Team Milestone: Vector Index Recall Benchmark',
      description:
        'Benchmark HNSW vs IVFFlat recall@10 and p95 query latency across 50k document embeddings. Upload Jupyter notebook and CSV results to OneDrive.',
      dueDate: addDays(now, 3),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs404-vector-benchmark',
      targetType: 'specific_groups',
      submissionType: 'group',
      createdBy: profId,
      targetGroupIds: [capstoneGroupId],
    });

    await ensureAssignment(client, {
      courseId: cs404Id,
      title: 'Capstone Proposal & Architecture Review',
      description:
        'Finalize capstone problem statement, ER diagram, milestone breakdown, and evaluation metrics. Upload slide deck and spec document to OneDrive.',
      dueDate: addDays(now, 14),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs404-capstone-proposal',
      targetType: 'specific_groups',
      submissionType: 'group',
      createdBy: profId,
      targetGroupIds: [capstoneGroupId],
    });

    await ensureAssignment(client, {
      courseId: cs404Id,
      title: 'Individual Lab: RAG Evaluation Harness & Metrics',
      description:
        'Run faithfulness and context-precision checks across 25 test queries and upload your evaluation summary JSON + report.',
      dueDate: addDays(now, 12),
      onedriveLink: 'https://onedrive.live.com/?id=joineazy-cs404-rag-eval',
      targetType: 'all',
      submissionType: 'individual',
      createdBy: profId,
      targetGroupIds: [],
    });

    // Leader-only group submissions
    await ensureGroupSubmission(client, {
      assignmentId: lab1Id,
      groupId: alphaGroupId,
      confirmedBy: adnanId,
      note: 'Uploaded Raft_Design_GroupAlpha.pdf and state-machine diagrams.',
      confirmedAt: addHours(now, -72),
    });

    await ensureGroupSubmission(client, {
      assignmentId: lab1Id,
      groupId: betaGroupId,
      confirmedBy: rohanId,
      note: 'Final PDF and TLA+ trace uploaded to Lab 1 OneDrive folder.',
      confirmedAt: addHours(now, -60),
    });

    await ensureGroupSubmission(client, {
      assignmentId: lab2Id,
      groupId: alphaGroupId,
      confirmedBy: adnanId,
      note: 'Uploaded EXPLAIN ANALYZE report and CSV benchmark runs.',
      confirmedAt: addHours(now, -18),
    });

    await ensureGroupSubmission(client, {
      assignmentId: milestone1Id,
      groupId: betaGroupId,
      confirmedBy: rohanId,
      note: 'Stream pipeline repo archive and latency video uploaded.',
      confirmedAt: addHours(now, -6),
    });

    await ensureGroupSubmission(client, {
      assignmentId: vectorBenchId,
      groupId: capstoneGroupId,
      confirmedBy: priyaId,
      note: 'Uploaded HNSW recall@10 comparison notebook and latency chart.',
      confirmedAt: addHours(now, -10),
    });

    // Individual submissions
    await ensureIndividualSubmission(client, {
      assignmentId: cs401QuizId,
      confirmedBy: priyaId,
      note: 'Uploaded Lamport & Vector Clock trace PDF.',
      confirmedAt: addHours(now, -28),
    });

    await ensureIndividualSubmission(client, {
      assignmentId: cs402BtreeId,
      confirmedBy: adnanId,
      note: 'Uploaded B+ Tree page split diagram sheet.',
      confirmedAt: addHours(now, -14),
    });

    await ensureIndividualSubmission(client, {
      assignmentId: cs402BtreeId,
      confirmedBy: rohanId,
      note: 'Submitted annotated PDF with leaf split trace.',
      confirmedAt: addHours(now, -12),
    });

    await ensureIndividualSubmission(client, {
      assignmentId: cs403RbacId,
      confirmedBy: meeraId,
      note: 'Uploaded RBAC endpoint matrix and status code spec.',
      confirmedAt: addHours(now, -8),
    });

    return { usersSeeded: 5, coursesSeeded: 4, groupsSeeded: 3, assignmentsSeeded: 9 };
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
