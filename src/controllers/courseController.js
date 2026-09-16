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
  description: row.description || '',
  overview: row.overview || '',
  eligibility: row.eligibility || '',
  curriculum: row.curriculum || '',
  careerOpportunities: row.career_opportunities || '',
  currency: row.currency || 'USD',
  department: row.department || '',
  faculty: row.faculty || '',
  studyMode: row.study_mode || '',
  attendanceMode: row.attendance_mode || '',
  language: row.language || '',
  status: row.is_active === false ? 'INACTIVE' : 'ACTIVE',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const createCourse = async (req, res) => {
  try {
    const {
      name,
      degree,
      level,
      code,
      currency,
      department,
      study_mode,
      attendance_mode,
      language,
      is_active,
      status,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Course name is required',
      });
    }

    
    const result = await pool.query(
      `
      INSERT INTO courses (
        name, degree, level, code,
      
        currency, department, study_mode, attendance_mode, language, is_active
      )
      VALUES (
       
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      RETURNING *
      `,
      [
        name,
        degree || level || null,
        level || degree || null,
        code || null,
       
        currency || 'USD',
        department || null,
       
        study_mode || null,
        attendance_mode || null,
        language || null,
        status ? status === 'ACTIVE' : is_active !== undefined ? is_active : true,
      ]
    );

    const courseRow = result.rows[0];

   

    return res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data:courseRow,
     
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
      description,
      overview,
      eligibility,
      curriculum,
      career_opportunities,
      currency,
      department,
      faculty,
      study_mode,
      attendance_mode,
      language,
      is_active,
      status,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE courses
      SET
        name = $1,
        degree = $2,
        level = $3,
        code = $4,
        description = $5,
        overview = $6,
        eligibility = $7,
        curriculum = $8,
        career_opportunities = $9,
        currency = $10,
        department = $11,
        faculty = $12,
        study_mode = $13,
        attendance_mode = $14,
        language = $15,
        is_active = $16,
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $17
        AND is_deleted = false
      RETURNING *
      `,
      [
        name ?? current.name,
        degree ?? level ?? current.degree,
        level ?? degree ?? current.level,
        code ?? current.code,
        description ?? current.description,
        overview ?? current.overview,
        eligibility ?? current.eligibility,
        curriculum ?? current.curriculum,
        career_opportunities ?? current.career_opportunities,
        currency ?? current.currency,
        department ?? current.department,
        faculty ?? current.faculty,
        study_mode ?? current.study_mode,
        attendance_mode ?? current.attendance_mode,
        language ?? current.language,
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

const createCourseSpecializations = async (req, res) => {
  const { course_uuid, specialization_uuids } = req.body;

  if (!course_uuid || !Array.isArray(specialization_uuids) || !specialization_uuids.length) {
    return res.status(400).json({
      success: false,
      message: 'course_uuid and specialization_uuids are required',
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO course_specializations (
        course_uuid,
        specialization_uuid
      )
      SELECT $1, unnest($2::uuid[])
      ON CONFLICT (course_uuid, specialization_uuid)
      DO NOTHING
      `,
      [course_uuid, specialization_uuids]
    );

    return res.status(201).json({
      success: true,
      message: 'Course specializations linked successfully',
      data: {
        course_uuid,
        assignedSpecializations: result.rowCount,
      },
    });
  } catch (error) {
    console.error('Create course specializations error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to link course specializations',
    });
  }
};



const UNIVERSITY_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT
      uni.id AS university_id,
      uni.uuid AS university_uuid,
      uni.name AS university_name,
      COALESCE(uni.code, uni.short_name) AS university_code
    FROM university_courses uc
    INNER JOIN universities uni
      ON uni.uuid = uc.university_uuid
     AND uni.is_deleted = false
    WHERE uc.course_uuid = c.uuid
    LIMIT 1
  ) u ON true
`;

const SPECIALIZATIONS_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT json_agg(
      json_build_object(
        'uuid', s.uuid,
        'name', s.name,
        'code', s.code,
        'description', s.description,
        'fees', COALESCE(fees.fees, '[]'::json)
      ) ORDER BY s.name
    ) AS specializations
    FROM course_specializations cs
    INNER JOIN specializations s
      ON s.uuid = cs.specialization_uuid
     AND s.is_deleted = false
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'uuid', cf.uuid,
          'feeStructureType', cf.fee_structure_type,
          'totalPeriods', cf.total_periods,
          'periodNumber', cf.period_number,
          'periodLabel', cf.period_label,
          'amount', cf.amount,
          'currency', cf.currency
        ) ORDER BY cf.period_number ASC, cf.id ASC
      ) AS fees
      FROM course_fees cf
      WHERE cf.specialization_id = s.uuid
    ) fees ON true
    WHERE cs.course_uuid = c.uuid
  ) specs ON true
`;

const getCourses = async (req, res) => {
  try {
    const {
      search = '',
      universityId,
      university_id,
      universityUuid,
      university_uuid,
      level,
      status,
      page = 1,
      limit = 50,
      
    } = req.query;

    const uniRef = universityUuid || university_uuid || universityId || university_id;
    const params = [];
    const where = ['c.is_deleted = false'];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        c.name ILIKE $${params.length}
        OR COALESCE(c.code, '') ILIKE $${params.length}
        OR COALESCE(c.degree, '') ILIKE $${params.length}
      )`);
    }

    if (level) {
      params.push(level);
      where.push(`c.level = $${params.length}`);
    }

    if (status === 'ACTIVE') {
      where.push('c.is_active = true');
    } else if (status === 'INACTIVE') {
      where.push('c.is_active = false');
    }

    if (uniRef) {
      params.push(String(uniRef));
      where.push(`EXISTS (
        SELECT 1
        FROM university_courses uc
        INNER JOIN universities uni
          ON uni.uuid = uc.university_uuid
         AND uni.is_deleted = false
        WHERE uc.course_uuid = c.uuid
          AND (uni.id::text = $${params.length} OR uni.uuid::text = $${params.length})
      )`);
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(500, Math.max(1, Number(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM courses c
      WHERE ${where.join(' AND ')}
      `,
      params
    );

    const listParams = [...params, limitNum, offset];
    const result = await pool.query(
      `
      SELECT
        c.*,
        u.university_id,
        u.university_uuid,
        u.university_name,
        u.university_code,
        COALESCE(specs.specializations, '[]'::json) AS specializations
      FROM courses c
      ${UNIVERSITY_LATERAL}
      ${SPECIALIZATIONS_LATERAL}
      WHERE ${where.join(' AND ')}
      ORDER BY c.name ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      listParams
    );

    const total = countResult.rows[0]?.total || 0;

    return res.status(200).json({
      success: true,
      message: 'Courses fetched successfully',
      data: result.rows,
      courses: result.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.max(1, Math.ceil(total / limitNum)),
      },
    });
  } catch (error) {
    console.error('Get all courses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message,
    });
  }
};


const createContentParagraph = async (req, res) => {
  try {
      const {
          course_id,
          title,
          content,
          sort_order = 0
      } = req.body;

      if (!course_id) {
          return res.status(400).json({
              success: false,
              message: "course_id is required"
          });
      }

      if (!content) {
          return res.status(400).json({
              success: false,
              message: "content is required"
          });
      }

      const result = await pool.query(
          `
          INSERT INTO course_content_paragraphs
              (course_id, title, content, sort_order)
          VALUES
              ($1, $2, $3, $4)
          RETURNING *
          `,
          [
              course_id,
              title || null,
              content,
              Number(sort_order) || 0
          ]
      );

      res.status(201).json({
          success: true,
          message: "Content paragraph created successfully",
          data: result.rows[0]
      });

  } catch (error) {
      console.error("Create content paragraph error:", error);

      res.status(500).json({
          success: false,
          message: "Failed to create content paragraph",
          error: error.message
      });
  }
};

const getContentParagraphsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.query.course_id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'courseId is required',
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM course_content_paragraphs
      WHERE course_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [courseId]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get content paragraphs error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch content paragraphs',
      error: error.message,
    });
  }
};

const createFaq = async (req, res) => {
  try {
    const {
      course_uuid,
      question,
      answer,
      display = 0,
      is_active = true,
    } = req.body;

    if (!course_uuid || !question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'course_uuid, question and answer are required',
      });
    }

   

    const result = await pool.query(
      `
      INSERT INTO universities_faqs (
        
        course_uuid,
        question,
        answer,
        display,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        
        course_uuid,
        question,
        answer,
        String(Number(display) || 0),
        is_active === true || is_active === 'true' || is_active === '1',
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create FAQ Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create FAQ',
      error: error.message,
    });
  }
};

const getFaqsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.query.course_uuid;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'courseId is required',
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM universities_faqs
      WHERE course_uuid = $1
      ORDER BY display ASC, created_at ASC
      `,
      [courseId]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get course FAQs Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch course FAQs',
      error: error.message,
    });
  }
};

// Get All Course
module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  createFaq,
  getFaqsByCourse,
  createContentParagraph,
  getContentParagraphsByCourse,
  deleteCourse,
  createCourseSpecializations,
};
