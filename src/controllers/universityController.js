const { pool } = require('../config/db');

const mapUniversity = (row) => ({
  id: row.id,
  name: row.name,
  code: row.short_name || '',
  short_name: row.short_name,
  type: row.type || '',
  location: row.location || '',
  website: row.website || '',
  description: row.description || '',
  status: 'ACTIVE',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const createUniversity = async (req, res) => {
  try {
    const { name, short_name, code, description, website, location } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'University name is required',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO universities
      (name, short_name, description, website, location)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        name,
        short_name || code || null,
        description || null,
        website || null,
        location || null,
      ]
    );

    const university = mapUniversity(result.rows[0]);

    return res.status(201).json({
      success: true,
      message: 'University created successfully',
      data: university,
      university,
    });
  } catch (error) {
    console.error('Create university error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create university',
    });
  }
};

const getUniversities = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Number(limit) || 50);
    const offset = (pageNum - 1) * pageSize;
    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE name ILIKE $1 OR COALESCE(short_name, '') ILIKE $1 OR COALESCE(location, '') ILIKE $1`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM universities ${where}`,
      params
    );
    const total = countResult.rows[0].total;

    const listParams = [...params, pageSize, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const result = await pool.query(
      `SELECT * FROM universities ${where}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listParams
    );

    const universities = result.rows.map(mapUniversity);

    return res.json({
      success: true,
      universities,
      data: universities,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error('Get universities error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch universities',
    });
  }
};

module.exports = { createUniversity, getUniversities };
