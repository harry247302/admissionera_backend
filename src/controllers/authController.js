const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { query, pool } = require('../config/db');
const { signToken } = require('../utils/jwt');
const User = require('../models/User');

const setAuthCookie = (res, token) => {
  res.cookie("admissioneradatabase", token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(env.cookie.name, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  });
};


const register = async (req, res) => {
  try {
    const { name, email,phone_number,course,dob,state, password, role = "user" } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    // 2. Validate password
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // 3. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 4. Hash password
    const SALT_ROUNDS = 12;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 5. Insert user into PostgreSQL
    const result = await query(
      `INSERT INTO users (name, email, password, phone_number, course, dob, state, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING  name, email, phone_number, course, dob, state, role, created_at, updated_at`,
      [name.trim(), normalizedEmail, passwordHash, phone_number, course, dob, state, role]
    );

    // 6. Get the newly registered user
    const user = result.rows[0];

    // 7. Generate authentication token
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // 8. Set authentication cookie
    setAuthCookie(res, token);

    // 9. Return success response
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user,
    });
  } catch (err) {
    console.error("Register error:", err.message);

    // PostgreSQL unique constraint violation
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { rows } = await query(
      `SELECT name, email, password, role, created_at, updated_at
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [String(email).trim()]
    );

    console.log(rows);

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    // console.log(user);
    // console.log(password);
    // console.log(user.password);
    const isValid = await bcrypt.compare(password, user.password);
    console.log(isValid,"++++++++++++++++++++++++");

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const logout = (_req, res) => {
  clearAuthCookie(res);
  return res.json({ message: 'Logged out successfully' });
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      clearAuthCookie(res);
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const checkEmail = async (req, res) => {
  try {
    const { id } = req.user;
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    console.log(user.rows[0],"++++++++++++++++++++++++");
    return res.json({ user: user.rows[0] });
  } catch (err) {
    console.error('Check email error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { register, login, logout, me, checkEmail};
