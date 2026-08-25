const { pool } = require('../config/db');

const createSpecialization = async (req, res) => {
  try {
    const { course_id, name, description } = req.body;

    if (!course_id || !name) {
      return res.status(400).json({
        success: false,
        message: 'course_id and specialization name are required',
      });
    }

    const course = await pool.query(
      'SELECT id FROM courses WHERE id = $1',
      [course_id]
    );

    if (course.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO specializations
      (course_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [course_id, name, description || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Specialization created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create specialization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create specialization',
    });
  }
};

module.exports = { createSpecialization };
