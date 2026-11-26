const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { signToken } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../utils/errors');
const { registerSchema, loginSchema } = require('../validators/schemas');

const register = asyncHandler(async (req, res) => {
  const parsed = registerSchema.parse(req.body);
  const normalizedEmail = parsed.email.trim().toLowerCase();
  const normalizedStudentId =
    parsed.role === 'student' && parsed.studentId ? parsed.studentId.trim().toUpperCase() : null;

  const existingEmail = await query('SELECT id FROM users WHERE LOWER(email) = $1', [
    normalizedEmail,
  ]);
  if (existingEmail.rows.length > 0) {
    throw new AppError('An account with this email already exists', 409);
  }

  if (normalizedStudentId) {
    const existingStudentId = await query(
      'SELECT id FROM users WHERE LOWER(student_id) = LOWER($1)',
      [normalizedStudentId]
    );
    if (existingStudentId.rows.length > 0) {
      throw new AppError('This Student ID is already registered', 409);
    }
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  const user = await withTransaction(async (client) => {
    const insertResult = await client.query(
      `INSERT INTO users (name, email, student_id, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, student_id AS "studentId", role, created_at AS "createdAt"`,
      [parsed.name.trim(), normalizedEmail, normalizedStudentId, passwordHash, parsed.role]
    );
    const createdUser = insertResult.rows[0];

    // Auto-enroll newly registered students into existing courses so their dashboard is populated immediately
    if (createdUser.role === 'student') {
      await client.query(
        `INSERT INTO course_enrollments (course_id, student_id)
         SELECT id, $1 FROM courses
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [createdUser.id]
      );
    }

    return createdUser;
  });

  const token = signToken(user);

  res.status(201).json({ token, user });
});

const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.parse(req.body);
  const normalizedEmail = parsed.email.trim().toLowerCase();

  const result = await query(
    `SELECT id, name, email, student_id AS "studentId", password_hash AS "passwordHash", role, created_at AS "createdAt"
     FROM users
     WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid email or password', 401);
  }

  const record = result.rows[0];
  const isPasswordValid = await bcrypt.compare(parsed.password, record.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const user = {
    id: record.id,
    name: record.name,
    email: record.email,
    studentId: record.studentId,
    role: record.role,
    createdAt: record.createdAt,
  };
  const token = signToken(user);

  res.status(200).json({ token, user });
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json({ user: req.user });
});

module.exports = {
  register,
  login,
  me,
};
