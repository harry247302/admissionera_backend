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
  course_count: Number(row.course_count || 0),
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

const parseTextArray = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [parsed];
    }
  }

  if (!Array.isArray(parsed)) {
    throw Object.assign(
      new Error("Expected an array"),
      { status: 400 }
    );
  }

  return parsed
    .map((item) => {
      if (typeof item === "string") return item;

      if (item && typeof item === "object") {
        return (
          item.approval_name ??
          item.name ??
          item.id ??
          item.uuid ??
          ""
        );
      }

      return item == null ? "" : String(item);
    })
    .filter(Boolean);
};

// const getUniversityByUuidQuery = `
//   SELECT
//     u.*,
//     COALESCE(spec.specializations, '[]'::json) AS specializations
//   FROM universities u
//   LEFT JOIN LATERAL (
//     SELECT json_agg(
//       DISTINCT jsonb_build_object(
//         'uuid', s.uuid,
//         'name', s.name
//       )
//     ) AS specializations
//     FROM course_fees cf
//     JOIN specializations s
//       ON s.uuid = cf.specialization_id
//     WHERE cf.university_id = u.uuid
//   ) spec ON TRUE
// `;

// CREATE UNIVERSITY
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
      approvals,
      status,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "University name is required",
      });
    }

    const logo = await resolveUploadedPath(
      req.files?.logo?.[0],
      req.body.logo,
      "university-logo",
      null
    );

    const banner = await resolveUploadedPath(
      req.files?.banner?.[0],
      req.body.banner,
      "university-banner",
      null
    );

    const parsedRatings =
      ratings == null || ratings === "" ? null : Number(ratings);

    const parsedWorldRank =
      world_rank == null || world_rank === ""
        ? null
        : Number(world_rank);

    if (
      parsedRatings !== null &&
      (!Number.isFinite(parsedRatings) ||
        parsedRatings < 0 ||
        parsedRatings > 9.99)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ratings value",
      });
    }

    if (
      parsedWorldRank !== null &&
      (!Number.isInteger(parsedWorldRank) || parsedWorldRank < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "World rank must be a non-negative integer",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO universities (
        name, short_name, code, description, website, location,
        logo, banner, ratings, world_rank, grade,
        features, admission_process, career, is_active, approvals
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
      `,
      [
        String(name).trim(),
        short_name || code || null,
        code || null,
        description || null,
        website || null,
        location || null,
        logo,
        banner,
        parsedRatings,
        parsedWorldRank,
        grade || null,
        parseTextArray(features),
        parseTextArray(admission_process),
        parseTextArray(career),
        status !== undefined ? status === "ACTIVE" : true,
        parseTextArray(approvals),
      ]
    );

    const university = {
      ...result.rows[0],
      specializations: [],
    };

    return res.status(201).json({
      success: true,
      message: "University created successfully",
      data: university,
      university,
    });
  } catch (error) {
    console.error("Create university error:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to create university",
    });
  }
};
const updateUniversity = async (req, res) => {
  try {
    const { uuid } = req.params;

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
      approvals,
      status,
    } = req.body;

    // Check UUID, not id
    if (!uuid) {
      return res.status(400).json({
        success: false,
        message: "University UUID is required",
      });
    }

   
// const existing = await pool.query(
//   `
//   SELECT
//     u.*,
//     COALESCE(
//       spec.specializations,
//       '[]'::json
//     ) AS specializations
//   FROM universities u

//   LEFT JOIN LATERAL (
//     SELECT
//       json_agg(
//         DISTINCT jsonb_build_object(
//           'uuid', s.uuid,
//           'name', s.name
//         )
//       ) AS specializations
//     FROM course_fees cf
//     JOIN specializations s
//       ON s.uuid = cf.specialization_id
//     WHERE cf.university_id = u.uuid
//   ) spec ON TRUE

//   WHERE u.uuid = $1
//   `,
//   [uuid]
// );


//     if (!existing.rows.length) {
//       return res.status(404).json({
//         success: false,
//         message: "University not found",
//       });
//     }

//     const current = existing.rows[0];

//     const nextName = name !== undefined ? name : current.name;

//     if (!nextName) {
//       return res.status(400).json({
//         success: false,
//         message: "University name is required",
//       });
//     }

    const logoPath = await resolveUploadedPath(
      req.files?.logo?.[0],
      req.body.logo,
      "university-logo",
      current.logo
    );

    const bannerPath = await resolveUploadedPath(
      req.files?.banner?.[0],
      req.body.banner,
      "university-banner",
      current.banner
    );

    // const nextRatings =
    //   ratings === undefined
    //     ? current.ratings
    //     : ratings === "" || ratings == null
    //       ? null
    //       : Number(ratings);

    // const nextWorldRank =
    //   world_rank === undefined
    //     ? current.world_rank
    //     : world_rank === "" || world_rank == null
    //       ? null
    //       : Number(world_rank);

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
        approvals = $16,
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = $1
      RETURNING *
      `,
      [
        uuid,
        name,

        short_name !== undefined || code !== undefined,

        description !== undefined,

        website !== undefined,

        location !== undefined,

        logoPath,
        bannerPath,
        nextRatings,
        nextWorldRank,

        grade !== undefined,

        features !== undefined,

        admission_process !== undefined,

        career !== undefined,

        status !== undefined,

        approvals
      ]
    );

    // const university = mapUniversity(result.rows[0]);

    // Add specializations from course_fees
    // university.specializations = current.specializations;

    return res.status(200).json({
      success: true,
      message: "University updated successfully",
      data: university,
      university,
    });

  } catch (error) {
    console.error("Update university error:", error);

    const statusCode = error.status || 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update university",
    });
  }
};

const getUniversityById = async (req, res) => {
  try {
    const { uuid } = req.params;

    const result = await pool.query(
      `
      SELECT
        u.*,

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'uuid', c.uuid,
                'name', c.name,

                'fees',
                COALESCE(
                  (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'uuid', cf.uuid,
                        'fee_structure_type', cf.fee_structure_type,
                        'total_periods', cf.total_periods,
                        'period_number', cf.period_number,
                        'period_label', cf.period_label,
                        'amount', cf.amount,
                        'currency', cf.currency
                      )
                      ORDER BY cf.period_number
                    )
                    FROM course_fees cf
                    WHERE cf.university_id = u.uuid
                      AND cf.course_id = c.uuid
                  ),
                  '[]'::jsonb
                )
              )
            )
            FROM courses c
            WHERE EXISTS (
              SELECT 1
              FROM course_fees cf
              WHERE cf.university_id = u.uuid
                AND cf.course_id = c.uuid
            )
          ),
          '[]'::jsonb
        ) AS courses

      FROM universities u
      WHERE u.uuid = $1
      `,
      [String(uuid)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "University not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "University fetched successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Get university by id error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get university by id",
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
    let where = 'WHERE u.is_deleted = false';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.name ILIKE $1 OR COALESCE(u.short_name, '') ILIKE $1 OR COALESCE(u.location, '') ILIKE $1)`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM universities u ${where}`,
      params
    );
    const total = countResult.rows[0].total;

    const listParams = [...params, pageSize, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const result = await pool.query(
      `SELECT u.*, COALESCE(cc.course_count, 0)::int AS course_count
       FROM universities u
       LEFT JOIN (
         SELECT uc.university_uuid, COUNT(DISTINCT uc.course_uuid)::int AS course_count
         FROM university_courses uc
         INNER JOIN courses c
           ON c.uuid = uc.course_uuid
          AND c.is_deleted = false
         GROUP BY uc.university_uuid
       ) cc ON cc.university_uuid = u.uuid
       ${where}
       ORDER BY u.created_at DESC
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
module.exports = { createUniversity, updateUniversity, getUniversities, deleteUniversity,getUniversityById };
