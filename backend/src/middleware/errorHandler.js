const { ZodError } = require('zod');
const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return res.status(400).json({
      error: details[0]?.message || 'Validation failed',
      details,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }

  if (err && err.code) {
    if (err.code === '23505') {
      const constraint = err.constraint || '';
      if (constraint.includes('email')) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      if (constraint.includes('student_id')) {
        return res.status(409).json({ error: 'This Student ID is already registered' });
      }
      if (constraint.includes('courses')) {
        return res.status(409).json({ error: 'A course with this code already exists' });
      }
      if (constraint.includes('submissions')) {
        return res.status(409).json({ error: 'Submission has already been acknowledged' });
      }
      return res.status(409).json({ error: 'Duplicate record already exists' });
    }

    if (err.code === '23503') {
      return res.status(400).json({ error: 'Referenced record does not exist' });
    }

    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Invalid input syntax' });
    }
  }

  console.error('Unhandled error:', err);
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(500).json({ error: message });
}

module.exports = { errorHandler };
