const { Pool } = require('pg');
require('dotenv').config();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'db', 'postgres']);

function extractDatabaseHost() {
  if (process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      return parsed.hostname || '';
    } catch {
      return '';
    }
  }
  return process.env.PGHOST || 'localhost';
}

function resolveSslConfig() {
  if (process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  if (process.env.DATABASE_SSL === 'false') {
    return false;
  }

  const host = extractDatabaseHost().toLowerCase();
  if (process.env.NODE_ENV === 'production' && host && !LOCAL_HOSTS.has(host)) {
    return { rejectUnauthorized: false };
  }

  return false;
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: resolveSslConfig(),
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'joineazy_task1',
      ssl: resolveSslConfig(),
    };

const pool = new Pool({
  ...poolConfig,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
};
