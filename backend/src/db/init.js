const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);
}

if (require.main === module) {
  initDatabase()
    .then(async () => {
      console.log('Database schema initialized successfully.');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Failed to initialize database schema:', err);
      await pool.end();
      process.exit(1);
    });
}

module.exports = { initDatabase };
