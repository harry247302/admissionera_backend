const { pool } = require("../config/db");

const createFaq = async (req, res) => {
  try {
    const {
      university_id,
      question,
      answer,
      display = 0,
      is_active = true,
    } = req.body;

    if (!university_id || !question || !answer) {
      return res.status(400).json({
        success: false,
        message: "university_id, question and answer are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO universities_faqs (
        university_uuid,
        question,
        answer,
        display,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        university_id,
        question,
        answer,
        Number(display) || 0,
        is_active === true || is_active === 'true' || is_active === '1',
      ]
    );

    return res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create FAQ Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create FAQ",
      error: error.message,
    });
  }
};


// Get all FAQs for a university
const getFaqsByUniversity = async (req, res) => {
  try {
    const universityId = req.params.universityId || req.params.university_uuid;

    const result = await pool.query(
      `
      SELECT *
      FROM universities_faqs
      WHERE university_uuid = $1
      ORDER BY display ASC, created_at ASC
      `,
      [universityId]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get FAQs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch FAQs",
      error: error.message,
    });
  }
};


// Get single FAQ
const getFaqById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM universities_faqs
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get FAQ Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch FAQ",
      error: error.message,
    });
  }
};


// Update FAQ
const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      question,
      answer,
      display,
      is_active,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE universities_faqs
      SET
        question = COALESCE($1, question),
        answer = COALESCE($2, answer),
        display = COALESCE($3, display),
        is_active = COALESCE($4, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
      `,
      [question, answer, display, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update FAQ Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update FAQ",
      error: error.message,
    });
  }
};


// Delete FAQ
const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM universities_faqs
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    console.error("Delete FAQ Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete FAQ",
      error: error.message,
    });
  }
};


const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readOptionalNumber = (value, key) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return { error: `${key} must be a valid number` };
  }
  return number;
};

const optionalText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
};

const optionalUuid = (value, label) => {
  const text = optionalText(value);
  if (!text) return null;
  if (!UUID_PATTERN.test(text)) {
    return { error: `${label} must be a valid UUID` };
  }
  return text;
};



const filterCourses = async (req, res) => {
  try {
    const source = { ...(req.query || {}), ...(req.body || {}) };
    const uuid = optionalUuid(req.params.uuid || source.uuid, "Course UUID");
    const specialization = optionalUuid(source.specialization, "Specialization");
    const session = optionalUuid(source.session || source.sessionId, "Session");
    const worldRank = readOptionalNumber(source.worldRank, "worldRank");

    const invalid = [uuid, specialization, session, worldRank].find(
      (value) => value && typeof value === "object"
    );
    if (invalid) {
      return res.status(400).json({
        success: false,
        message: invalid.error,
      });
    }

    const pageNum = Math.max(1, Number(source.page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(source.limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const query = `
      SELECT
        c.*,

        /* FAQs */
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', faq.id,
                'question', faq.question,
                'answer', faq.answer,
                'display', faq.display,
                'is_active', faq.is_active,
                'created_at', faq.created_at,
                'updated_at', faq.updated_at
              )
              ORDER BY faq.created_at
            )
            FROM universities_faqs faq
            WHERE faq.course_uuid = c.uuid
          ),
          '[]'::jsonb
        ) AS faqs,

        /* COURSE CONTENT PARAGRAPHS */
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', scp.id,
                'title', scp.title,
                'content', scp.content,
                'sort_order', scp.sort_order,
                'created_at', scp.created_at,
                'updated_at', scp.updated_at
              )
              ORDER BY scp.sort_order
            )
            FROM course_content_paragraphs scp
            WHERE scp.course_id = c.uuid
          ),
          '[]'::jsonb
        ) AS course_content_paragraphs,

        /* SPECIALIZATIONS */
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', sp.id,
                'uuid', sp.uuid,
                'name', sp.name,
                'slug', sp.slug,
                'code', sp.code,
                'short_name', sp.short_name,
                'description', sp.description
              )
              ORDER BY sp.name
            )
            FROM specializations sp
            WHERE sp.uuid IN (
              SELECT cs.specialization_uuid
              FROM course_specializations cs
              WHERE cs.course_uuid = c.uuid

              UNION

              SELECT cf.specialization_id
              FROM course_fees cf
              WHERE cf.course_id = c.uuid

              UNION

              SELECT p.specialization_uuid
              FROM specialization_content_paragraphs p
              WHERE p.course_id = c.uuid

              UNION

              SELECT t.specialization_uuid
              FROM specialization_content_tables t
              WHERE t.course_id = c.uuid
                AND t.specialization_uuid IS NOT NULL
            )
            AND sp.is_deleted = FALSE
            AND sp.is_active = TRUE
          ),
          '[]'::jsonb
        ) AS specializations,

        /* UNIVERSITIES OFFERING THIS COURSE */
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'uuid', uni.uuid,
                'name', uni.name,
                'short_name', uni.short_name,
                'logo', uni.logo,
                'location', uni.location,
                'ratings', uni.ratings,
                'world_rank', uni.world_rank
              )
              ORDER BY uni.name
            )
            FROM (
              SELECT DISTINCT
                u.uuid,
                u.name,
                u.short_name,
                u.logo,
                u.location,
                u.ratings,
                u.world_rank
              FROM course_fees cf
              JOIN universities u
                ON u.uuid = cf.university_id
              WHERE cf.course_id = c.uuid
                AND u.is_active = TRUE
                AND u.is_deleted = FALSE
            ) uni
          ),
          '[]'::jsonb
        ) AS universities,

        /* SPECIALIZATION CONTENT TABLES */
        COALESCE(
          sct_data.specialization_content_tables,
          '[]'::jsonb
        ) AS specialization_content_tables

      FROM courses c

      /* TABLES WITH THEIR ROWS */
      LEFT JOIN LATERAL (
        SELECT
          jsonb_agg(
            jsonb_build_object(
              'id', sct.id,
              'title', sct.title,
              'sort_order', sct.sort_order,
              'specialization_uuid', sct.specialization_uuid,
              'course_id', sct.course_id,
              'created_at', sct.created_at,
              'updated_at', sct.updated_at,
              'rows',
              COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', scr.id,
                      'label', scr.label,
                      'content', scr.content,
                      'sort_order', scr.sort_order
                    )
                    ORDER BY scr.sort_order
                  )
                  FROM specialization_content_rows scr
                  WHERE scr.table_id = sct.id
                ),
                '[]'::jsonb
              )
            )
            ORDER BY sct.sort_order
          ) AS specialization_content_tables

        FROM specialization_content_tables sct
        WHERE sct.course_id = c.uuid
      ) sct_data ON TRUE

      WHERE
        c.is_deleted = FALSE
        AND (
          $1::uuid IS NULL
          OR c.uuid = $1::uuid
        )

        /* UNIVERSITY NAME */
        AND (
          $2::text IS NULL
          OR EXISTS (
            SELECT 1
            FROM course_fees cf
            JOIN universities u
              ON u.uuid = cf.university_id
            WHERE cf.course_id = c.uuid
              AND u.name ILIKE '%' || $2 || '%'
              AND u.is_active = TRUE
              AND u.is_deleted = FALSE
          )
        )

        /* COURSE NAME */
        AND (
          $3::text IS NULL
          OR c.name ILIKE '%' || $3 || '%'
        )

        /* SPECIALIZATION UUID */
        AND (
          $4::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM course_fees cf
            WHERE cf.course_id = c.uuid
              AND cf.specialization_id = $4::uuid
          )
        )

        /* SESSION UUID */
        AND (
          $5::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM course_fees cf
            WHERE cf.course_id = c.uuid
              AND cf.session_id = $5::uuid
          )
        )

        /* COURSE LEVEL */
        AND (
          $6::text IS NULL
          OR c.level ILIKE $6
        )

        /* STUDY MODE */
        AND (
          $7::text IS NULL
          OR c.study_mode ILIKE $7
        )

        /* UNIVERSITY WORLD RANK */
        AND (
          $8::integer IS NULL
          OR EXISTS (
            SELECT 1
            FROM course_fees cf
            JOIN universities u
              ON u.uuid = cf.university_id
            WHERE cf.course_id = c.uuid
              AND u.world_rank = $8::integer
              AND u.is_active = TRUE
              AND u.is_deleted = FALSE
          )
        )

      ORDER BY c.name ASC
      LIMIT $9
      OFFSET $10
    `;

    const values = [
      uuid,
      optionalText(source.university || source.universityName),
      optionalText(source.course || source.courseName),
      specialization,
      session,
      optionalText(source.level),
      optionalText(source.studyMode),
      worldRank == null ? null : Math.trunc(worldRank),
    ];

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM courses c
      WHERE
        c.is_deleted = FALSE
        AND ($1::uuid IS NULL OR c.uuid = $1::uuid)
        AND (
          $2::text IS NULL
          OR EXISTS (
            SELECT 1
            FROM course_fees cf
            JOIN universities u ON u.uuid = cf.university_id
            WHERE cf.course_id = c.uuid
              AND u.name ILIKE '%' || $2 || '%'
              AND u.is_active = TRUE
              AND u.is_deleted = FALSE
          )
        )
        AND ($3::text IS NULL OR c.name ILIKE '%' || $3 || '%')
        AND (
          $4::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM course_fees cf
            WHERE cf.course_id = c.uuid
              AND cf.specialization_id = $4::uuid
          )
        )
        AND (
          $5::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM course_fees cf
            WHERE cf.course_id = c.uuid
              AND cf.session_id = $5::uuid
          )
        )
        AND ($6::text IS NULL OR c.level ILIKE $6)
        AND ($7::text IS NULL OR c.study_mode ILIKE $7)
        AND (
          $8::integer IS NULL
          OR EXISTS (
            SELECT 1
            FROM course_fees cf
            JOIN universities u ON u.uuid = cf.university_id
            WHERE cf.course_id = c.uuid
              AND u.world_rank = $8::integer
              AND u.is_active = TRUE
              AND u.is_deleted = FALSE
          )
        )
      `,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const result = await pool.query(query, [...values, limitNum, offset]);

    return res.status(200).json({
      success: true,
      message: total
        ? "Courses fetched successfully"
        : "No courses match the provided filters",
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: total ? Math.ceil(total / limitNum) : 0,
      },
      data: result.rows,
    });
  } catch (error) {
    console.error("Get course by UUID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

module.exports = {
  createFaq,
  filterCourses,
  getFaqsByUniversity,
  getFaqById,
  updateFaq,
  deleteFaq,
};