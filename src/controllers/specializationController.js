const { pool } = require('../config/db');

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const createSpecialization = async (req, res) => {
  const { course_id, name, description, slug } = req.body;

  if (!course_id || !name) {
    return res.status(400).json({
      success: false,
      message: 'course_id and specialization name are required',
    });
  }

  const generatedSlug = slugify(slug || name);
  if (!generatedSlug) {
    return res.status(400).json({
      success: false,
      message: 'A valid slug could not be generated from the specialization name',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const course = await client.query(
      'SELECT uuid FROM courses WHERE uuid = $1',
      [course_id]
    );

    if (course.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const specializationResult = await client.query(
      `
      INSERT INTO specializations
      (name, slug, description)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [name, generatedSlug, description || null]
    );

    const specialization = specializationResult.rows[0];

    await client.query(
      `
      INSERT INTO course_specializations
      (course_uuid, specialization_uuid)
      VALUES ($1, $2)
      `,
      [course_id, specialization.uuid]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Specialization created successfully',
      data: specialization,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create specialization error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Specialization slug already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create specialization',
    });
  } finally {
    client.release();
  }
};
const universitySpecilization = async (req, res) => {
  const { university_uuid, specialization_uuid } = req.body;

  if (!university_uuid || !specialization_uuid) {
    return res.status(400).json({
      success: false,
      message: 'university_uuid and specialization_uuid are required',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const university = await client.query(
      'SELECT uuid FROM universities WHERE uuid = $1 AND is_deleted = false',
      [university_uuid]
    );

    if (university.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'University not found',
      });
    }

    const specialization = await client.query(
      'SELECT uuid FROM specializations WHERE uuid = $1 AND is_deleted = false',
      [specialization_uuid]
    );

    if (specialization.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Specialization not found',
      });
    }

    const universitySpecializationResult = await client.query(
      `
      INSERT INTO university_specializations
      (university_uuid, specialization_uuid)
      VALUES ($1, $2)
      RETURNING *
      `,
      [university_uuid, specialization_uuid]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'University specialization created successfully',
      data: universitySpecializationResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create university specialization error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'University specialization already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create university specialization',
    });
  } finally {
    client.release();
  }
};

module.exports = { createSpecialization, universitySpecilization };
