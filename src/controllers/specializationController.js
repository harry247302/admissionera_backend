const { pool } = require('../config/db');

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const SPECIALIZATION_COLUMNS = `
  uuid, name, slug, code, short_name, description, overview, eligibility,
  admission_requirements, career_opportunities, duration, duration_unit,
  is_active, created_at, updated_at
`;

const createSpecialization = async (req, res) => {
  const {
    name,
    slug,
    code,
    short_name,
    description,
    overview,
    eligibility,
    admission_requirements,
    career_opportunities,
    duration,
    duration_unit,
    is_active,
    status,
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Specialization name is required',
    });
  }

  const generatedSlug = slugify(slug || name);
  if (!generatedSlug) {
    return res.status(400).json({
      success: false,
      message: 'A valid slug could not be generated from the specialization name',
    });
  }

  const parsedDuration =
    duration === '' || duration === null || duration === undefined
      ? null
      : Number(duration);

  try {
    const result = await pool.query(
      `
      INSERT INTO specializations (
        name, slug, code, short_name, description, overview, eligibility,
        admission_requirements, career_opportunities, duration, duration_unit, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${SPECIALIZATION_COLUMNS}
      `,
      [
        name.trim(),
        generatedSlug,
        code?.trim() || null,
        short_name?.trim() || null,
        description?.trim() || null,
        overview?.trim() || null,
        eligibility?.trim() || null,
        admission_requirements?.trim() || null,
        career_opportunities?.trim() || null,
        Number.isFinite(parsedDuration) ? parsedDuration : null,
        duration_unit?.trim() || null,
        status ? status === 'ACTIVE' : is_active !== undefined ? Boolean(is_active) : true,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Specialization created successfully',
      data: result.rows[0],
      specialization: result.rows[0],
    });
  } catch (error) {
    console.error('Create specialization error:', error);

    if (error.code === '23505') {
      const message = error.constraint?.includes('code')
        ? 'Specialization code already exists'
        : 'Specialization slug already exists';
      return res.status(409).json({ success: false, message });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create specialization',
    });
  }
};

const getSpecializations = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const params = [];
    let where = 'WHERE is_deleted = FALSE';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (
        name ILIKE $${params.length}
        OR COALESCE(code, '') ILIKE $${params.length}
        OR COALESCE(slug, '') ILIKE $${params.length}
        OR COALESCE(short_name, '') ILIKE $${params.length}
      )`;
    }

    const result = await pool.query(
      `
      SELECT ${SPECIALIZATION_COLUMNS}
      FROM specializations
      ${where}
      ORDER BY name ASC
      `,
      params
    );

    return res.json({
      success: true,
      specializations: result.rows,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get specializations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch specializations',
    });
  }
};

const updateSpecialization = async (req, res) => {
  const { uuid } = req.params;
  const {
    name,
    slug,
    code,
    short_name,
    description,
    overview,
    eligibility,
    admission_requirements,
    career_opportunities,
    duration,
    duration_unit,
    is_active,
    status,
  } = req.body;

  try {
    const existing = await pool.query(
      `SELECT * FROM specializations WHERE uuid = $1 AND is_deleted = FALSE`,
      [uuid]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Specialization not found',
      });
    }

    const row = existing.rows[0];
    const nextName = name?.trim() || row.name;
    const nextSlug = slugify(slug || nextName);
    const parsedDuration =
      duration === '' || duration === null || duration === undefined
        ? row.duration
        : Number(duration);

    let nextActive = row.is_active;
    if (status !== undefined) nextActive = status === 'ACTIVE';
    else if (is_active !== undefined) nextActive = Boolean(is_active);

    const result = await pool.query(
      `
      UPDATE specializations
      SET
        name = $2,
        slug = $3,
        code = $4,
        short_name = $5,
        description = $6,
        overview = $7,
        eligibility = $8,
        admission_requirements = $9,
        career_opportunities = $10,
        duration = $11,
        duration_unit = $12,
        is_active = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $1 AND is_deleted = FALSE
      RETURNING ${SPECIALIZATION_COLUMNS}
      `,
      [
        uuid,
        nextName,
        nextSlug,
        code !== undefined ? (code?.trim() || null) : row.code,
        short_name !== undefined ? (short_name?.trim() || null) : row.short_name,
        description !== undefined ? (description?.trim() || null) : row.description,
        overview !== undefined ? (overview?.trim() || null) : row.overview,
        eligibility !== undefined ? (eligibility?.trim() || null) : row.eligibility,
        admission_requirements !== undefined
          ? (admission_requirements?.trim() || null)
          : row.admission_requirements,
        career_opportunities !== undefined
          ? (career_opportunities?.trim() || null)
          : row.career_opportunities,
        Number.isFinite(parsedDuration) ? parsedDuration : null,
        duration_unit !== undefined ? (duration_unit?.trim() || null) : row.duration_unit,
        nextActive,
      ]
    );

    return res.json({
      success: true,
      message: 'Specialization updated successfully',
      data: result.rows[0],
      specialization: result.rows[0],
    });
  } catch (error) {
    console.error('Update specialization error:', error);

    if (error.code === '23505') {
      const message = error.constraint?.includes('code')
        ? 'Specialization code already exists'
        : 'Specialization slug already exists';
      return res.status(409).json({ success: false, message });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update specialization',
    });
  }
};

const deleteSpecialization = async (req, res) => {
  const { uuid } = req.params;

  try {
    const result = await pool.query(
      `
      UPDATE specializations
      SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $1 AND is_deleted = FALSE
      RETURNING uuid
      `,
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Specialization not found',
      });
    }

    return res.json({
      success: true,
      message: 'Specialization deleted successfully',
      data: { uuid: result.rows[0].uuid },
    });
  } catch (error) {
    console.error('Delete specialization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete specialization',
    });
  }
};

const getUniversitySpecializations = async (req, res) => {
  try {
    const universityUuid = req.query.university_uuid || req.query.universityUuid;

    if (!universityUuid) {
      return res.status(400).json({
        success: false,
        message: 'university_uuid is required',
      });
    }

    const result = await pool.query(
      `
      SELECT
        s.uuid,
        s.name,
        s.slug,
        s.code,
        s.short_name,
        s.description,
        us.created_at AS assigned_at
      FROM university_specializations us
      INNER JOIN specializations s ON s.uuid = us.specialization_uuid
      WHERE us.university_uuid = $1
        AND s.is_deleted = FALSE
      ORDER BY s.name ASC
      `,
      [universityUuid]
    );

    return res.json({
      success: true,
      specializations: result.rows,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get university specializations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch university specializations',
    });
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

module.exports = {
  createSpecialization,
  getSpecializations,
  updateSpecialization,
  deleteSpecialization,
  getUniversitySpecializations,
  universitySpecilization,
};
