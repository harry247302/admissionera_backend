const { pool } = require('../config/db');
const {
  saveUniversityImageAsWebp,
  removeUploadedFile,
} = require('../middleware/uploadUniversityMedia');

/** Store rich-text HTML in text[] columns as a single-element array. */
const toTextArray = (value) => {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) {
    const cleaned = value.map((v) => String(v).trim()).filter(Boolean);
    return cleaned.length ? cleaned : null;
  }
  return [String(value)];
};

/** Read text[] (or text) back as a single HTML/string for the form. */
const fromTextArray = (value) => {
  if (Array.isArray(value)) return value[0] || value.join('\n') || '';
  return value || '';
};

const mapUniversity = (row) => ({
  id: row.id,
  uuid: row.uuid,
  name: row.name,
  code: row.short_name || row.code || '',
  short_name: row.short_name,
  type: row.type || '',
  location: row.location || '',
  website: row.website || '',
  description: row.description || '',
  logo: row.logo || '',
  banner: row.banner || '',
  ratings: row.ratings ?? null,
  world_rank: row.world_rank ?? null,
  grade: row.grade || '',
  features: fromTextArray(row.features),
  admission_process: fromTextArray(row.admission_process),
  career: fromTextArray(row.career),
  status: row.is_active === false ? 'INACTIVE' : 'ACTIVE',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveUploadedPath = async (file, bodyValue, prefix, currentPath) => {
  if (file) {
    const nextPath = await saveUniversityImageAsWebp(file, prefix);
    if (currentPath && currentPath !== nextPath) {
      await removeUploadedFile(currentPath);
    }
    return nextPath;
  }
  if (bodyValue !== undefined) {
    return bodyValue || null;
  }
  return currentPath || null;
};

const createUniversity = async (req, res) => {
  try {
    const {
      name,
      short_name,
      code,
      description,
      website,
      location,
      ratings,
      world_rank,
      grade,
      features,
      admission_process,
      career,
      status,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'University name is required',
      });
    }

    const logoPath = await resolveUploadedPath(
      req.files?.logo?.[0],
      req.body.logo,
      'university-logo',
      null
    );
    const bannerPath = await resolveUploadedPath(
      req.files?.banner?.[0],
      req.body.banner,
      'university-banner',
      null
    );

    const result = await pool.query(
      `
      INSERT INTO universities
      (
        name, short_name, description, website, location,
        logo, banner, ratings, world_rank, grade,
        features, admission_process, career, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
      `,
      [
        name,
        short_name || code || null,
        description || null,
        website || null,
        location || null,
        logoPath,
        bannerPath,
        ratings === '' || ratings == null ? null : Number(ratings),
        world_rank === '' || world_rank == null ? null : Number(world_rank),
        grade || null,
        toTextArray(features),
        toTextArray(admission_process),
        toTextArray(career),
        status ? status === 'ACTIVE' : true,
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
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create university',
    });
  }
};

const updateUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      short_name,
      code,
      description,
      website,
      location,
      ratings,
      world_rank,
      grade,
      features,
      admission_process,
      career,
      status,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'University id is required',
      });
    }

    const existing = await pool.query(
      `
      SELECT *
      FROM universities
      WHERE is_deleted = false
        AND (uuid::text = $1 OR id::text = $1)
      LIMIT 1
      `,
      [String(id)]
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'University not found',
      });
    }

    const current = existing.rows[0];
    const nextName = name !== undefined ? name : current.name;

    if (!nextName) {
      return res.status(400).json({
        success: false,
        message: 'University name is required',
      });
    }

    const logoPath = await resolveUploadedPath(
      req.files?.logo?.[0],
      req.body.logo,
      'university-logo',
      current.logo
    );
    const bannerPath = await resolveUploadedPath(
      req.files?.banner?.[0],
      req.body.banner,
      'university-banner',
      current.banner
    );

    const nextRatings =
      ratings === undefined
        ? current.ratings
        : ratings === '' || ratings == null
          ? null
          : Number(ratings);
    const nextWorldRank =
      world_rank === undefined
        ? current.world_rank
        : world_rank === '' || world_rank == null
          ? null
          : Number(world_rank);

    const result = await pool.query(
      `
      UPDATE universities
      SET
        name = $2,
        short_name = $3,
        description = $4,
        website = $5,
        location = $6,
        logo = $7,
        banner = $8,
        ratings = $9,
        world_rank = $10,
        grade = $11,
        features = $12,
        admission_process = $13,
        career = $14,
        is_active = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $1
      RETURNING *
      `,
      [
        current.uuid,
        nextName,
        short_name !== undefined || code !== undefined
          ? (short_name || code || null)
          : current.short_name,
        description !== undefined ? (description || null) : current.description,
        website !== undefined ? (website || null) : current.website,
        location !== undefined ? (location || null) : current.location,
        logoPath,
        bannerPath,
        nextRatings,
        nextWorldRank,
        grade !== undefined ? (grade || null) : current.grade,
        features !== undefined ? toTextArray(features) : current.features,
        admission_process !== undefined
          ? toTextArray(admission_process)
          : current.admission_process,
        career !== undefined ? toTextArray(career) : current.career,
        status !== undefined ? status === 'ACTIVE' : current.is_active,
      ]
    );

    const university = mapUniversity(result.rows[0]);

    return res.status(200).json({
      success: true,
      message: 'University updated successfully',
      data: university,
      university,
    });
  } catch (error) {
    console.error('Update university error:', error);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update university',
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
    let where = 'WHERE is_deleted = false';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (name ILIKE $1 OR COALESCE(short_name, '') ILIKE $1 OR COALESCE(location, '') ILIKE $1)`;
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

const deleteUniversity = async (req, res) => {
  try {
    const { uuid } = req.params;
    const result = await pool.query(
      `UPDATE universities SET is_deleted = true WHERE uuid = $1`,
      [String(uuid)]
    );

    // if (!result.rows.length) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'University not found',
    //   });
    // }

    return res.status(200).json({
      success: true,
      message: 'University deleted successfully',
    });
  } catch (error) {
    console.error('Delete university error:', error);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete university',
    });
  }
};
module.exports = { createUniversity, updateUniversity, getUniversities, deleteUniversity };
