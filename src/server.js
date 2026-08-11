const app = require('./app');
const env = require('./config/env');
const { connect } = require('./config/db');

const startServer = () =>
  new Promise((resolve, reject) => {
    const server = app.listen(env.port, () => {
      console.log(`Server running on http://localhost:${env.port}`);
      resolve(server);
    });

    server.on('error', reject);
  });

const start = async () => {
  try {
    await connect();
    await startServer();
  } catch (err) {
    const detail = err.message || err.code || String(err);
    console.error('Failed to start server:', detail);

    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use. Stop the other process or change PORT in .env`);
    }

    if (err.code === '3D000') {
      console.error(`Database "${env.db.name}" does not exist. Create it first, then run: npm run migrate`);
    }

    if (err.code === '28P01') {
      console.error('PostgreSQL authentication failed. Check DB_USER and DB_PASSWORD in .env');
    }

    if (['ECONNREFUSED', 'ETIMEDOUT'].includes(err.code)) {
      console.error('Could not reach PostgreSQL. Ensure the service is running on the configured host/port.');
    }

    process.exit(1);
  }
};

start();
