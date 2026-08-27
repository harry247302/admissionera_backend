const { pool } = require('../config/db');

const mapCourse = (row) => ({
  id: row.uuid || row.id,
  uuid: row.uuid,
  universityId: row.university_id,
  universityUuid: row.university_uuid,
  universityName: row.university_name || '',
  universityCode: row.university_code || '',
  name: row.name,
  code: row.code || '',
  degree: row.degree || '',
  level: row.level || row.degree || '',
  duration: row.duration,
  durationUnit: row.duration_unit || 'YEARS',
  numberOfSemesters: row.duration_unit === 'SEMESTERS' ? Number(row.duration) : null,
  numberOfYears: row.duration_unit === 'YEARS' ? Number(row.duration) : null,
  description: row.description || '',
  eligibility: row.eligibility || '',
  status: row.is_active === false ? 'INACTIVE' : 'ACTIVE',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseDuration = (duration, durationUnit) => {
  if (duration == null || duration === '') {
    return { value: null, unit: durationUnit || null };
  }
  if (typeof duration === 'string' && /[a-zA-Z]/.test(duration)) {
    const [amount, ...unitParts] = duration.trim().split(/\s+/);
    return {
      value: Number(amount) || null,
      unit: durationUnit || unitParts.join('_').toUpperCase() || 'YEARS',
    };
  }
  return {
    value: Number(duration),
    unit: durationUnit || 'YEARS',
  };
};

const createCourse = async (req, res) => {
  try {
    const {
      university_id,
      universityId,
      university_uuid,
      name,
      degree,
      level,
      code,
      duration,
      duration_unit,
      durationUnit,
      description,
      overview,
      eligibility,
      admission_requirements,
      application_process,
      curriculum,
      specialization,
      career_opportunities,
      tuition_fee,
      application_fee,
      currency,
      department,
      faculty,
      study_mode,
      attendance_mode,
      intake,
      language,
      course_url,
      is_active,
      status,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Course name is required',
      });
    }

    const uniRef = university_uuid || university_id || universityId;
    let university = null;
    if (uniRef) {
      const uniResult = await pool.query(
        `SELECT id, uuid, name, short_name, code
         FROM universities
         WHERE is_deleted = false
           AND (id::text = $1 OR uuid::text = $1)
         LIMIT 1`,
        [String(uniRef)]
      );
      university = uniResult.rows[0] || null;
      if (!university) {
        return res.status(404).json({
          success: false,
          message: 'University not found',
        });
      }
    }

    const parsedDuration = parseDuration(duration, duration_unit || durationUnit);

    const result = await pool.query(
      `
      INSERT INTO courses (
        name, degree, level, code, duration, duration_unit,
        description, overview, eligibility, admission_requirements,
        application_process, curriculum, specialization, career_opportunities,
        tuition_fee, application_fee, currency, department, faculty,
        study_mode, attendance_mode, intake, language, course_url, is_active
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25
      )
      RETURNING *
      `,
      [
        name,
        degree || level || null,
        level || degree || null,
        code || null,
        parsedDuration.value,
        parsedDuration.unit,
        description || null,
        overview || null,
        eligibility || null,
        admission_requirements || null,
        application_process || null,
        curriculum || null,
        specialization || null,
        career_opportunities || null,
        tuition_fee || null,
        application_fee || null,
        currency || 'USD',
        department || null,
        faculty || null,
        study_mode || null,
        attendance_mode || null,
        intake || null,
        language || null,
        course_url || null,
        status ? status === 'ACTIVE' : is_active !== undefined ? is_active : true,
      ]
    );

    const courseRow = result.rows[0];

    if (university?.uuid) {
      await pool.query(
        `
        INSERT INTO university_courses (university_uuid, course_uuid)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [university.uuid, courseRow.uuid]
      );
    }

    const course = mapCourse({
      ...courseRow,
      university_id: university?.id,
      university_uuid: university?.uuid,
      university_name: university?.name,
      university_code: university?.code || university?.short_name,
    });

    return res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course,
      course,
    });
  } catch (error) {
    console.error('Create course error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Course code already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create course',
      error: error.message,
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
    const where = ['c.is_deleted = false'];

    if (uniId) {
      params.push(String(uniId));
      where.push(`(u.id::text = $${params.length} OR u.uuid::text = $${params.length})`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        c.name ILIKE $${params.length}
        OR COALESCE(c.code, '') ILIKE $${params.length}
        OR COALESCE(c.level, '') ILIKE $${params.length}
        OR COALESCE(u.name, '') ILIKE $${params.length}
      )`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM courses c
       LEFT JOIN university_courses uc ON uc.course_uuid = c.uuid
       LEFT JOIN universities u ON u.uuid = uc.university_uuid AND u.is_deleted = false
       ${whereSql}`,
      params
    );
    const total = countResult.rows[0].total;

    const result = await pool.query(
      `SELECT
         c.*,
         u.id AS university_id,
         u.uuid AS university_uuid,
         u.name AS university_name,
         COALESCE(u.code, u.short_name) AS university_code
       FROM courses c
       LEFT JOIN university_courses uc ON uc.course_uuid = c.uuid
       LEFT JOIN universities u ON u.uuid = uc.university_uuid AND u.is_deleted = false
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    const courses = result.rows.map(mapCourse);

    return res.status(200).json({
      success: true,
      count: courses.length,
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
      error: error.message,
    });
  }
};

const getCourseById = async (req, res) => {
  try {
    const { uuid } = req.params;

    const result = await pool.query(
      `
      SELECT
        c.*,
        u.id AS university_id,
        u.uuid AS university_uuid,
        u.name AS university_name,
        COALESCE(u.code, u.short_name) AS university_code
      FROM courses c
      LEFT JOIN university_courses uc ON uc.course_uuid = c.uuid
      LEFT JOIN universities u ON u.uuid = uc.university_uuid AND u.is_deleted = false
      WHERE c.uuid = $1
        AND c.is_deleted = false
      LIMIT 1
      `,
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: mapCourse(result.rows[0]),
    });
  } catch (error) {
    console.error('Get course error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch course',
      error: error.message,
    });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { uuid } = req.params;
    const existing = await pool.query(
      'SELECT * FROM courses WHERE uuid = $1 AND is_deleted = false',
      [uuid]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const current = existing.rows[0];
    const {
      university_id,
      universityId,
      university_uuid,
      name,
      degree,
      level,
      code,
      duration,
      duration_unit,
      durationUnit,
      description,
      overview,
      eligibility,
      admission_requirements,
      application_process,
      curriculum,
      specialization,
      career_opportunities,
      tuition_fee,
      application_fee,
      currency,
      department,
      faculty,
      study_mode,
      attendance_mode,
      intake,
      language,
      course_url,
      is_active,
      status,
    } = req.body;

    const parsedDuration = parseDuration(
      duration ?? current.duration,
      duration_unit || durationUnit || current.duration_unit
    );

    const result = await pool.query(
      `
      UPDATE courses
      SET
        name = $1,
        degree = $2,
        level = $3,
        code = $4,
        duration = $5,
        duration_unit = $6,
        description = $7,
        overview = $8,
        eligibility = $9,
        admission_requirements = $10,
        application_process = $11,
        curriculum = $12,
        specialization = $13,
        career_opportunities = $14,
        tuition_fee = $15,
        application_fee = $16,
        currency = $17,
        department = $18,
        faculty = $19,
        study_mode = $20,
        attendance_mode = $21,
        intake = $22,
        language = $23,
        course_url = $24,
        is_active = $25,
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $26
        AND is_deleted = false
      RETURNING *
      `,
      [
        name ?? current.name,
        degree ?? level ?? current.degree,
        level ?? degree ?? current.level,
        code ?? current.code,
        parsedDuration.value,
        parsedDuration.unit,
        description ?? current.description,
        overview ?? current.overview,
        eligibility ?? current.eligibility,
        admission_requirements ?? current.admission_requirements,
        application_process ?? current.application_process,
        curriculum ?? current.curriculum,
        specialization ?? current.specialization,
        career_opportunities ?? current.career_opportunities,
        tuition_fee ?? current.tuition_fee,
        application_fee ?? current.application_fee,
        currency ?? current.currency,
        department ?? current.department,
        faculty ?? current.faculty,
        study_mode ?? current.study_mode,
        attendance_mode ?? current.attendance_mode,
        intake ?? current.intake,
        language ?? current.language,
        course_url ?? current.course_url,
        status ? status === 'ACTIVE' : is_active ?? current.is_active,
        uuid,
      ]
    );

    const courseRow = result.rows[0];
    const uniRef = university_uuid || university_id || universityId;
    let university = null;

    if (uniRef) {
      const uniResult = await pool.query(
        `SELECT id, uuid, name, short_name, code
         FROM universities
         WHERE is_deleted = false
           AND (id::text = $1 OR uuid::text = $1)
         LIMIT 1`,
        [String(uniRef)]
      );
      university = uniResult.rows[0] || null;
      if (university?.uuid) {
        await pool.query(
          'DELETE FROM university_courses WHERE course_uuid = $1',
          [uuid]
        );
        await pool.query(
          `
          INSERT INTO university_courses (university_uuid, course_uuid)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [university.uuid, uuid]
        );
      }
    } else {
      const linked = await pool.query(
        `SELECT u.id, u.uuid, u.name, u.short_name, u.code
         FROM university_courses uc
         JOIN universities u ON u.uuid = uc.university_uuid AND u.is_deleted = false
         WHERE uc.course_uuid = $1
         LIMIT 1`,
        [uuid]
      );
      university = linked.rows[0] || null;
    }

    const course = mapCourse({
      ...courseRow,
      university_id: university?.id,
      university_uuid: university?.uuid,
      university_name: university?.name,
      university_code: university?.code || university?.short_name,
    });

    return res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: course,
      course,
    });
  } catch (error) {
    console.error('Update course error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Course code already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update course',
      error: error.message,
    });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { uuid } = req.params;

    const result = await pool.query(
      `
      UPDATE courses
      SET
        is_deleted = true,
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $1
        AND is_deleted = false
      RETURNING uuid
      `,
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    console.error('Delete course error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete course',
    });
  }
};

const createUniversityCourse = async (req, res) => {
  const { university_uuid, course_uuid } = req.body;

  if (!university_uuid || !course_uuid) {
    return res.status(400).json({
      success: false,
      message: 'university_uuid and course_uuid are required',
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

    const course = await client.query(
      'SELECT uuid FROM courses WHERE uuid = $1 AND is_deleted = false',
      [course_uuid]
    );

    if (course.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const result = await client.query(
      `
      INSERT INTO university_courses
      (university_uuid, course_uuid)
      VALUES ($1, $2)
      RETURNING *
      `,
      [university_uuid, course_uuid]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'University course created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create university course error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'University course already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create university course',
    });
  } finally {
    client.release();
  }
};

const getUniversityCourses = async (req, res) => {
  try {
    const { university_uuid, course_uuid } = req.query;
    const params = [];
    const filters = [];

    if (university_uuid) {
      params.push(university_uuid);
      filters.push(`uc.university_uuid = $${params.length}`);
    }

    if (course_uuid) {
      params.push(course_uuid);
      filters.push(`uc.course_uuid = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(
      `
      SELECT
        uc.university_uuid,
        uc.course_uuid,
        uc.created_at,
        to_jsonb(u) AS university,
        to_jsonb(c) AS course,
        COALESCE((
          SELECT json_agg(to_jsonb(s) ORDER BY s.name)
          FROM course_specializations cs
          JOIN specializations s
            ON s.uuid = cs.specialization_uuid
           AND s.is_deleted = false
          WHERE cs.course_uuid = uc.course_uuid
        ), '[]'::json) AS specializations
      FROM university_courses uc
      JOIN universities u
        ON u.uuid = uc.university_uuid
       AND u.is_deleted = false
      JOIN courses c
        ON c.uuid = uc.course_uuid
       AND c.is_deleted = false
      ${where}
      ORDER BY uc.created_at DESC
      `,
      params
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get university courses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch university courses',
    });
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  createUniversityCourse,
  getUniversityCourses,
};
