const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { query } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const groupRoutes = require('./routes/groupRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

function buildCorsOptions() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw.trim() === '*') {
    return { origin: true, credentials: true };
  }

  const allowedOrigins = new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  };
}

app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res, next) => {
  try {
    await query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use(errorHandler);

module.exports = app;
