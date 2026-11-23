const app = require('../src/app');
const { query } = require('../src/config/db');
const { initDatabase } = require('../src/db/init');
const { seedDatabase } = require('../src/db/seed');

let bootstrapPromise = null;

async function ensureBootstrapped() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await initDatabase();

      if (process.env.SEED_DEMO_DATA === 'true') {
        const usersCountRes = await query('SELECT COUNT(*)::int AS count FROM users');
        if (usersCountRes.rows[0].count === 0) {
          try {
            await seedDatabase({ closePool: false });
          } catch (seedErr) {
            // Ignore unique-constraint race if another cold-start instance seeded concurrently
            if (seedErr?.code !== '23505') {
              throw seedErr;
            }
          }
        }
      }
    })().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }

  return bootstrapPromise;
}

module.exports = async (req, res) => {
  await ensureBootstrapped();
  return app(req, res);
};
