const { pool } = require('../config/db');

const mapCourse = (row) => ({
  id: row.id,
  universityId: row.university_id,
  university_id: row.university_id,
  universityName: row.university_name || '',
  name: row.name,
  code: row.degree || '',
  degree: row.degree || '',
  level: row.degree || '',
  duration: row.duration || '',
  durationUnit: 'YEARS',
  description: row.description || '',
  status: 'ACTIVE',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const createCourse = async (req, res) => {
  try {
    const {
      university_id,
      universityId,
      name,
      degree,
      level,
      code,
      duration,
      durationUnit,
      description,
    } = req.body;

    const uniId = university_id || universityId;

    if (!uniId || !name) {
      return res.status(400).json({
        success: false,
        message: 'university_id and course name are required',
      });
    }

    const university = await pool.query(
      'SELECT id FROM universities WHERE id = $1',
      [uniId]
    );

    if (university.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'University not found',
      });
    }

    const durationValue =
      duration == null || duration === ''
        ? null
        : durationUnit
          ? `${duration} ${durationUnit}`
          : String(duration);

    const result = await pool.query(
      `
      INSERT INTO courses
      (university_id, name, degree, duration, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        uniId,
        name,
        degree || level || code || null,
        durationValue,
        description || null,
      ]
    );

    const uniName = await pool.query(
      'SELECT name FROM universities WHERE id = $1',
      [uniId]
    );
    const course = mapCourse({
      ...result.rows[0],
      university_name: uniName.rows[0]?.name,
    });

    return res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course,
      course,
    });
  } catch (error) {
    console.error('Create course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create course',
    });
  }
};

const getCourses = async (req, res) => {
  try {
    const { search = '', universityId, university_id, page = 1, limit = 50 } = req.query;
    const uniId = universityId || university_id;
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Number(limit) || 50);
    const offset = (pageNum - 1) * pageSize;
    const params = [];
    const where = [];

    if (uniId) {
      params.push(uniId);
      where.push(`c.university_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.name ILIKE $${params.length} OR COALESCE(c.degree, '') ILIKE $${params.length} OR COALESCE(u.name, '') ILIKE $${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM courses c
       LEFT JOIN universities u ON u.id = c.university_id
       ${whereSql}`,
      params
    );
    const total = countResult.rows[0].total;

    const listParams = [...params, pageSize, offset];
    const result = await pool.query(
      `SELECT c.*, u.name AS university_name
       FROM courses c
       LEFT JOIN universities u ON u.id = c.university_id
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    );

    const courses = result.rows.map(mapCourse);

    return res.json({
      success: true,
      courses,
      data: courses,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error('Get courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
    });
  }
};

module.exports = { createCourse, getCourses };
