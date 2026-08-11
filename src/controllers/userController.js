const { query } = require('../config/db');
const User = require('../models/User');

const getAllUsers = async (_req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY id'
    );

    const users = rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));

    return res.json({ users });
  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getAllUsers, getProfile };
