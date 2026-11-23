require('dotenv').config();
const app = require('./app');
const { pool, query } = require('./config/db');
const { initDatabase } = require('./db/init');
const { seedDatabase } = require('./db/seed');

const PORT = Number(process.env.PORT || 5000);

async function bootstrap() {
  await initDatabase();

  if (process.env.SEED_DEMO_DATA === 'true') {
    const usersCountRes = await query('SELECT COUNT(*)::int AS count FROM users');
    if (usersCountRes.rows[0].count === 0) {
      const summary = await seedDatabase({ closePool: false });
      console.log('Seeded initial demo data:', summary);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`Joineazy Task 1 API listening on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch(async (error) => {
  console.error('Failed to start backend server:', error);
  await pool.end().catch(() => {});
  process.exit(1);
});
