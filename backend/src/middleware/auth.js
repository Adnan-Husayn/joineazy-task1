const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { AppError } = require('../utils/errors');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be configured in production');
  }
  return 'dev-joineazy-jwt-secret-change-me';
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication required', 401));
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next(new AppError('Authentication token missing', 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      return next(new AppError('Invalid or expired session token', 401));
    }

    const result = await query(
      `SELECT id, name, email, student_id AS "studentId", role, created_at AS "createdAt"
       FROM users
       WHERE id = $1`,
      [decoded.sub]
    );

    if (result.rows.length === 0) {
      return next(new AppError('User account no longer exists', 401));
    }

    req.user = result.rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    return next();
  };
}

module.exports = {
  signToken,
  authenticate,
  requireRole,
};
