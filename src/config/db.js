const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

const query = (text, params) => pool.query(text, params);

const connect = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connected');
  } finally {
    client.release();
  }
};

module.exports = { pool, query, connect };
