const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const migrationsDir = path.join(__dirname, '../../migrations');

const runMigrations = async () => {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query(
      'SELECT filename FROM schema_migrations ORDER BY id'
    );
    const appliedSet = new Set(applied.map((row) => row.filename));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('Migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
