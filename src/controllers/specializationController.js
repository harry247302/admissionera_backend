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

const getByIdSpecialization = async (req,res)=>{
  try {
    const { uuid } = req.params;
    const result = await pool.query(
      `SELECT * FROM specializations WHERE uuid = $1 AND is_deleted = FALSE`,
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
      specialization: result.rows[0],
    });
  } catch (error) {
    console.error('Get by id specialization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get specialization by id',
    });
  }
}
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

const FEE_STRUCTURE_TYPES = new Set(['yearly', 'semester', 'one_time']);

const COURSE_FEE_COLUMNS = `
  uuid, university_id, course_id, specialization_id, session_id,
  fee_structure_type, total_periods, period_number, period_label,
  amount, currency,
  per_seme_fees, per_year_fees, total_sem, total_years,
  created_at, updated_at
`;

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const pickFeeSummaryFields = (body = {}) => ({
  perSemesterFee: toNullableNumber(
    body.per_semester_fee ?? body.perSemesterFee ?? body.per_seme_fees ?? body.perSemeFees
  ),
  perYearFee: toNullableNumber(
    body.per_year_fee ?? body.perYearFee ?? body.per_year_fees ?? body.perYearFees
  ),
  totalSem: toNullableNumber(body.total_sem ?? body.totalSem),
  totalYears: toNullableNumber(body.total_years ?? body.totalYears),
});

const normalizeFeeStructureType = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (FEE_STRUCTURE_TYPES.has(normalized)) return normalized;
  if (normalized === 'year') return 'yearly';
  if (normalized === 'one-time' || normalized === 'onetime') return 'one_time';
  return normalized;
};

const resolveUniversityUuid = async (ref) => {
  if (!ref) return null;
  const result = await pool.query(
    `SELECT uuid FROM universities
     WHERE is_deleted = false
       AND (uuid::text = $1 OR id::text = $1)
     LIMIT 1`,
    [String(ref)]
  );
  return result.rows[0]?.uuid || null;
};

const resolveCourseUuid = async (ref) => {
  if (!ref) return null;
  const result = await pool.query(
    `SELECT uuid FROM courses
     WHERE is_deleted = false
       AND uuid::text = $1
     LIMIT 1`,
    [String(ref)]
  );
  return result.rows[0]?.uuid || null;
};

const resolveSessionUuid = async (ref) => {
  if (!ref) return null;
  const result = await pool.query(
    `SELECT id FROM session WHERE id::text = $1 LIMIT 1`,
    [String(ref)]
  );
  return result.rows[0]?.id || null;
};

const resolveSpecializationUuid = async (ref) => {
  if (!ref) return null;
  const result = await pool.query(
    `SELECT uuid FROM specializations
     WHERE is_deleted = false
       AND (uuid::text = $1 OR id::text = $1)
     LIMIT 1`,
    [String(ref)]
  );
  return result.rows[0]?.uuid || null;
};

const createCourseFee = async (req, res) => {
  try {
    const {
      university_id,
      universityId,
      course_id,
      courseId,
      specialization_id,
      specializationId,
      session_id,
      sessionId,
      fee_structure_type,
      feeStructureType,
      total_periods,
      totalPeriods,
      period_number,
      periodNumber,
      period_label,
      periodLabel,
      amount,
      per_semester_fee,
      per_year_fee,
      total_sem,
      total_years,
      currency = 'INR',
    } = req.body;

    const universityRef = university_id || universityId;
    const courseRef = course_id || courseId;
    const specializationRef = specialization_id || specializationId;
    const sessionRef = session_id || sessionId;
    const structureType = normalizeFeeStructureType(fee_structure_type || feeStructureType);
    const periods = total_periods ?? totalPeriods ?? null;
    const periodNo = period_number ?? periodNumber ?? null;
    const label = period_label ?? periodLabel ?? null;
    const summary = pickFeeSummaryFields(req.body);

    if (!universityRef) {
      return res.status(400).json({
        success: false,
        message: 'university_id is required',
      });
    }

    if (!courseRef) {
      return res.status(400).json({
        success: false,
        message: 'course_id is required',
      });
    }

    if (!specializationRef) {
      return res.status(400).json({
        success: false,
        message: 'specialization_id is required',
      });
    }

    if (!sessionRef) {
      return res.status(400).json({
        success: false,
        message: 'session_id is required',
      });
    }

    if (!structureType || !FEE_STRUCTURE_TYPES.has(structureType)) {
      return res.status(400).json({
        success: false,
        message: 'fee_structure_type must be yearly, semester, or one_time',
      });
    }

    if (amount === undefined || amount === null || amount === '' || Number.isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        message: 'amount is required',
      });
    }

    const universityUuid = await resolveUniversityUuid(universityRef);
    if (!universityUuid) {
      return res.status(404).json({
        success: false,
        message: 'University not found',
      });
    }

    const courseUuid = await resolveCourseUuid(courseRef);
    if (!courseUuid) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const specializationUuid = await resolveSpecializationUuid(specializationRef);
    if (!specializationUuid) {
      return res.status(404).json({
        success: false,
        message: 'Specialization not found',
      });
    }

    const sessionUuid = await resolveSessionUuid(sessionRef);
    if (!sessionUuid) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO course_fees (
        university_id,
        course_id,
        specialization_id,
        session_id,
        fee_structure_type,
        total_periods,
        period_number,
        period_label,
        amount,
        currency,
        per_seme_fees,
        per_year_fees,
        total_sem,
        total_years
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING ${COURSE_FEE_COLUMNS}
      `,
      [
        universityUuid,
        courseUuid,
        specializationUuid,
        sessionUuid,
        structureType,
        periods === '' || periods == null ? null : Number(periods),
        periodNo === '' || periodNo == null ? null : Number(periodNo),
        label || null,
        Number(amount),
        currency || 'INR',
        summary.perSemesterFee,
        summary.perYearFee,
        summary.totalSem,
        summary.totalYears,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Course fee created successfully',
      data: result.rows[0],
      fee: result.rows[0],
    });
  } catch (error) {
    console.error('Create Course Fee Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create course fee',
      error: error.message,
    });
  }
};

const updateCourseFee = async (req, res) => {
  try {
    const { uuid } = req.params;
    const {
      university_id,
      universityId,
      course_id,
      courseId,
      specialization_id,
      specializationId,
      session_id,
      sessionId,
      fee_structure_type,
      feeStructureType,
      total_periods,
      totalPeriods,
      period_number,
      periodNumber,
      period_label,
      periodLabel,
      amount,
      per_semester_fee,
      per_year_fee,
      total_sem,
      total_years,
      currency,
    } = req.body;

    const existing = await pool.query(
      `SELECT * FROM course_fees WHERE uuid = $1`,
      [uuid]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course fee not found',
      });
    }

    const current = existing.rows[0];

    let nextUniversityId = current.university_id;
    const universityRef = university_id || universityId;
    if (universityRef !== undefined && universityRef !== null && universityRef !== '') {
      const resolved = await resolveUniversityUuid(universityRef);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'University not found',
        });
      }
      nextUniversityId = resolved;
    }

    let nextCourseId = current.course_id;
    const courseRef = course_id || courseId;
    if (courseRef !== undefined && courseRef !== null && courseRef !== '') {
      const resolved = await resolveCourseUuid(courseRef);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }
      nextCourseId = resolved;
    }

    let nextSpecializationId = current.specialization_id;
    const specializationRef = specialization_id || specializationId;
    if (specializationRef !== undefined && specializationRef !== null && specializationRef !== '') {
      const resolved = await resolveSpecializationUuid(specializationRef);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'Specialization not found',
        });
      }
      nextSpecializationId = resolved;
    }

    let nextSessionId = current.session_id;
    if (session_id !== undefined || sessionId !== undefined) {
      const sessionRef = session_id ?? sessionId;
      if (sessionRef === null || sessionRef === '') {
        nextSessionId = null;
      } else {
        const resolved = await resolveSessionUuid(sessionRef);
        if (!resolved) {
          return res.status(404).json({
            success: false,
            message: 'Session not found',
          });
        }
        nextSessionId = resolved;
      }
    }

    let nextStructureType = current.fee_structure_type;
    const rawStructureType = fee_structure_type ?? feeStructureType;
    if (rawStructureType !== undefined) {
      const normalized = normalizeFeeStructureType(rawStructureType);
      if (!normalized || !FEE_STRUCTURE_TYPES.has(normalized)) {
        return res.status(400).json({
          success: false,
          message: 'fee_structure_type must be yearly, semester, or one_time',
        });
      }
      nextStructureType = normalized;
    }

    const nextTotalPeriods =
      total_periods !== undefined || totalPeriods !== undefined
        ? (total_periods ?? totalPeriods)
        : current.total_periods;
    const nextPeriodNumber =
      period_number !== undefined || periodNumber !== undefined
        ? (period_number ?? periodNumber)
        : current.period_number;
    const nextPeriodLabel =
      period_label !== undefined || periodLabel !== undefined
        ? (period_label ?? periodLabel)
        : current.period_label;
    const nextAmount = amount !== undefined ? amount : current.amount;
    const nextCurrency = currency !== undefined ? currency : current.currency;
    const summary = pickFeeSummaryFields(req.body);
    const nextPerSemesterFee =
      per_semester_fee !== undefined || req.body.perSemesterFee !== undefined || req.body.per_seme_fees !== undefined
        ? summary.perSemesterFee
        : current.per_seme_fees;
    const nextPerYearFee =
      per_year_fee !== undefined || req.body.perYearFee !== undefined || req.body.per_year_fees !== undefined
        ? summary.perYearFee
        : current.per_year_fees;
    const nextTotalSem =
      total_sem !== undefined || req.body.totalSem !== undefined
        ? summary.totalSem
        : current.total_sem;
    const nextTotalYears =
      total_years !== undefined || req.body.totalYears !== undefined
        ? summary.totalYears
        : current.total_years;

    if (nextAmount === null || nextAmount === '' || Number.isNaN(Number(nextAmount))) {
      return res.status(400).json({
        success: false,
        message: 'amount is required',
      });
    }

    const result = await pool.query(
      `
      UPDATE course_fees
      SET
        university_id = $2,
        course_id = $3,
        specialization_id = $4,
        session_id = $5,
        fee_structure_type = $6,
        total_periods = $7,
        period_number = $8,
        period_label = $9,
        amount = $10,
        currency = $11,
        per_seme_fees = $12,
        per_year_fees = $13,
        total_sem = $14,
        total_years = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $1
      RETURNING ${COURSE_FEE_COLUMNS}
      `,
      [
        uuid,
        nextUniversityId,
        nextCourseId,
        nextSpecializationId,
        nextSessionId,
        nextStructureType,
        nextTotalPeriods === '' || nextTotalPeriods == null ? null : Number(nextTotalPeriods),
        nextPeriodNumber === '' || nextPeriodNumber == null ? null : Number(nextPeriodNumber),
        nextPeriodLabel || null,
        Number(nextAmount),
        nextCurrency || 'INR',
        nextPerSemesterFee,
        nextPerYearFee,
        nextTotalSem,
        nextTotalYears,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Course fee updated successfully',
      data: result.rows[0],
      fee: result.rows[0],
    });
  } catch (error) {
    console.error('Update Course Fee Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update course fee',
      error: error.message,
    });
  }
};

const deleteCourseFee = async (req, res) => {
  try {
    const { uuid } = req.params;

    const result = await pool.query(
      `DELETE FROM course_fees WHERE uuid = $1 RETURNING uuid`,
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course fee not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Course fee deleted successfully',
      data: { uuid: result.rows[0].uuid },
    });
  } catch (error) {
    console.error('Delete Course Fee Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete course fee',
      error: error.message,
    });
  }
};


const getCourseFeesBySpecialization = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;

    const data = await pool.query(
      `
      SELECT
          cf.id,
          cf.uuid,
          cf.fee_structure_type,
          cf.total_periods,
          cf.period_number,
          cf.period_label,
          cf.amount,
          cf.currency,
          cf.session_id,
          cf.per_seme_fees,
          cf.per_year_fees,
          cf.total_sem,
          cf.total_years,

          u.id AS university_numeric_id,
          u.uuid AS university_id,
          u.name AS university_name,

          c.uuid AS course_id,
          c.name AS course_name,

          s.uuid AS specialization_id,
          s.name AS specialization_name,

          sess.name AS session_name,
          sess.start_date AS session_start_date,
          sess.expiry_date AS session_expiry_date

      FROM course_fees cf

      LEFT JOIN universities u
          ON u.uuid = cf.university_id

      LEFT JOIN courses c
          ON c.uuid = cf.course_id

      LEFT JOIN specializations s
          ON s.uuid = cf.specialization_id

      LEFT JOIN session sess
          ON sess.id = cf.session_id

      ORDER BY cf.id DESC

      LIMIT $1
      OFFSET $2;
      `,
      [limit, offset]
    );

    return res.json({
      success: true,
      page,
      limit,
      data: data.rows,
      fees: data.rows,
    });

  } catch (error) {
    console.error('Get Course Fees Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch course fees',
      error: error.message,
    });
  }
};


const createContentTable = async (req, res) => {
  try {
    const {
      specialization_uuid,
      specialization_id,
      course_id,
      title,
      sort_order = 0,
    } = req.body;

    const specializationRef = specialization_uuid || specialization_id || null;
    const courseRef = course_id || null;

    if (!specializationRef && !courseRef) {
      return res.status(400).json({
        success: false,
        message: 'specialization_uuid or course_id is required',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO specialization_content_tables
        (specialization_uuid, course_id, title, sort_order)
      VALUES
        ($1, $2, $3, $4)
      RETURNING *
      `,
      [specializationRef, courseRef, title || null, Number(sort_order) || 0]
    );

    return res.status(201).json({
      success: true,
      message: 'Content table created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create content table error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create content table',
      error: error.message,
    });
  }
};

const createContentRow = async (req, res) => {
  try {
    const {
      table_id,
      label,
      content = {},
      sort_order = 0,
    } = req.body;

    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: 'table_id is required',
      });
    }

    if (!label) {
      return res.status(400).json({
        success: false,
        message: 'label is required',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO specialization_content_rows
        (table_id, label, content, sort_order)
      VALUES
        ($1, $2, $3::jsonb, $4)
      RETURNING *
      `,
      [
        table_id,
        label,
        JSON.stringify(content || {}),
        Number(sort_order) || 0,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Content row created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create content row error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create content row',
      error: error.message,
    });
  }
};

const getContentTablesByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.query.course_id || null;
    const specializationId =
      req.params.specializationId
      || req.query.specialization_uuid
      || req.query.specialization_id
      || null;

    if (!courseId && !specializationId) {
      return res.status(400).json({
        success: false,
        message: 'courseId or specializationId is required',
      });
    }

    const tablesResult = await pool.query(
      courseId
        ? `
          SELECT *
          FROM specialization_content_tables
          WHERE course_id = $1
          ORDER BY sort_order ASC, created_at ASC
        `
        : `
          SELECT *
          FROM specialization_content_tables
          WHERE specialization_uuid = $1
          ORDER BY sort_order ASC, created_at ASC
        `,
      [courseId || specializationId]
    );

    const tables = [];
    for (const table of tablesResult.rows) {
      const rowsResult = await pool.query(
        `
        SELECT *
        FROM specialization_content_rows
        WHERE table_id = $1
        ORDER BY sort_order ASC, created_at ASC
        `,
        [table.id]
      );
      tables.push({
        ...table,
        rows: rowsResult.rows,
      });
    }

    return res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
    });
  } catch (error) {
    console.error('Get content tables error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch content tables',
      error: error.message,
    });
  }
};

const deleteContentTablesByParent = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.query.course_id || null;
    const specializationId =
      req.params.specializationId
      || req.query.specialization_uuid
      || req.query.specialization_id
      || null;

    if (!courseId && !specializationId) {
      return res.status(400).json({
        success: false,
        message: 'courseId or specializationId is required',
      });
    }

    const result = await pool.query(
      courseId
        ? `
          DELETE FROM specialization_content_tables
          WHERE course_id = $1
          RETURNING id
        `
        : `
          DELETE FROM specialization_content_tables
          WHERE specialization_uuid = $1
          RETURNING id
        `,
      [courseId || specializationId]
    );

    return res.status(200).json({
      success: true,
      message: 'Content tables deleted successfully',
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Delete content tables error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete content tables',
      error: error.message,
    });
  }
};

const createContentParagraph = async (req, res) => {
  try {
    const {
      specialization_uuid,
      specialization_id,
      course_id,
      counsellor_id,
      title,
      content,
      sort_order = 0,
    } = req.body;

    const specializationRef = specialization_uuid || specialization_id || null;
    const courseRef = course_id || null;
    const counsellorRef = counsellor_id || null;
    if (!specializationRef && !courseRef) {
      return res.status(400).json({
        success: false,
        message: 'specialization_uuid or course_id is required',
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'content is required',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO specialization_content_paragraphs
        (specialization_uuid, course_id, title, content, sort_order)
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        specializationRef,
        courseRef,
        title || null,
        content,
        Number(sort_order) || 0,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Content paragraph created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create content paragraph error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create content paragraph',
      error: error.message,
    });
  }
};

const getContentParagraphsBySpecialization = async (req, res) => {
  try {
    const courseId = req.query.course_id || null;
    const specializationId =
      req.params.specializationId
      || req.query.specialization_uuid
      || req.query.specialization_id
      || null;

    if (!courseId && !specializationId) {
      return res.status(400).json({
        success: false,
        message: 'specializationId is required',
      });
    }

    const result = await pool.query(
      courseId
        ? `
          SELECT *
          FROM specialization_content_paragraphs
          WHERE course_id = $1
          ORDER BY sort_order ASC, created_at ASC
        `
        : `
          SELECT *
          FROM specialization_content_paragraphs
          WHERE specialization_uuid = $1
          ORDER BY sort_order ASC, created_at ASC
        `,
      [courseId || specializationId]
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

const deleteContentParagraphsByParent = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.query.course_id || null;
    const specializationId =
      req.params.specializationId
      || req.query.specialization_uuid
      || req.query.specialization_id
      || null;

    if (!courseId && !specializationId) {
      return res.status(400).json({
        success: false,
        message: 'courseId or specializationId is required',
      });
    }

    const result = await pool.query(
      courseId
        ? `
          DELETE FROM specialization_content_paragraphs
          WHERE course_id = $1
          RETURNING id
        `
        : `
          DELETE FROM specialization_content_paragraphs
          WHERE specialization_uuid = $1
          RETURNING id
        `,
      [courseId || specializationId]
    );

    return res.status(200).json({
      success: true,
      message: 'Content paragraphs deleted successfully',
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Delete content paragraphs error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete content paragraphs',
      error: error.message,
    });
  }
};

module.exports = {
  createSpecialization,
  getSpecializations,
  createContentTable,
  createContentRow,
  getContentTablesByCourse,
  deleteContentTablesByParent,
  createContentParagraph,
  getContentParagraphsBySpecialization,
  deleteContentParagraphsByParent,
  updateSpecialization,
  deleteSpecialization,
  getUniversitySpecializations,
  universitySpecilization,
  createCourseFee,
  updateCourseFee,
  getByIdSpecialization,
  deleteCourseFee,
  getCourseFeesBySpecialization,
};
