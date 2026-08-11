const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const SALT_ROUNDS = 12;

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
});

const User = {
  async create({ name, email, password, role = 'user' }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at, updated_at`,
      [name, email.toLowerCase(), passwordHash, role]
    );

    return toPublicUser(rows[0]);
  },

  async findByEmail(email) {
    const { rows } = await query(
      `SELECT id, name, email, password_hash, role, created_at, updated_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT id, name, email, role, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    return rows[0] ? toPublicUser(rows[0]) : null;
  },

  async comparePassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  },
};

module.exports = User;
