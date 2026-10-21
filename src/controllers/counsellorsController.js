const { pool } = require("../config/db");
const {
    saveCounsellorImageAsWebp,
    removeCounsellorImage,
} = require('../middleware/uploadCounsellorImage');

const COUNSELLOR_COLUMNS = `uuid, first_name, last_name, email, phone, alternate_phone, status,
    profile_img, notes, qualification, experience_years, state, designation, ratings,
    response_rate, career_development, created_at, updated_at`;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

/** Returns the value to store for an optional column (null when blank), or throws a 400 error. */
const normalizeOptionalField = (field, raw) => {
    const value = raw === null || raw === undefined ? '' : String(raw).trim();
    if (!value) return null;

    switch (field) {
        case 'experience_years': {
            const years = Number(value);
            if (!Number.isInteger(years) || years < 0 || years > 60) {
                throw badRequest('Experience must be a whole number between 0 and 60');
            }
            return years;
        }
        case 'ratings': {
            const rating = Number(value);
            if (!/^\d(\.\d)?$/.test(value) || rating < 0 || rating > 5) {
                throw badRequest('Rating must be between 0 and 5 with at most one decimal');
            }
            return rating;
        }
        case 'response_rate': {
            const match = value.match(/^(\d{1,3})\s*%?$/);
            const percent = match ? Number(match[1]) : NaN;
            if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
                throw badRequest('Response rate must be a percentage between 0 and 100');
            }
            return `${percent}%`;
        }
        case 'designation':
            if (value.length > 150) throw badRequest('Designation must be 150 characters or fewer');
            return value;
        case 'state':
            return value.toUpperCase();
        default:
            return value;
    }
};



const createCounsellor = async (req, res) => {
  const { first_name, last_name, phone, email, alternate_phone, qualification, experience_years, state, notes } = req.body;
    let profileImgPath = null;
    try {
        const designation = normalizeOptionalField('designation', req.body.designation);
        const ratings = normalizeOptionalField('ratings', req.body.ratings);
        const responseRate = normalizeOptionalField('response_rate', req.body.response_rate);
        const careerDevelopment = normalizeOptionalField('career_development', req.body.career_development);

        const existing = await pool.query('SELECT 1 FROM counsellors WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'Counsellor with this email already exists' });
        }

        if (req.file) {
            profileImgPath = await saveCounsellorImageAsWebp(req.file);
        }

        const newCounsellor = await pool.query(
            `INSERT INTO counsellors
                (first_name, last_name, phone, email, alternate_phone, qualification,
                 experience_years, state, notes, profile_img,
                 designation, ratings, response_rate, career_development)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING ${COUNSELLOR_COLUMNS}`,
            [first_name, last_name, phone, email, alternate_phone, qualification,
             experience_years, state, notes, profileImgPath,
             designation, ratings, responseRate, careerDevelopment]
        );

        res.status(201).json({
            message: 'Counsellor created successfully',
            counsellor: newCounsellor.rows[0]
        });
    } catch (error) {
        if (profileImgPath) await removeCounsellorImage(profileImgPath);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Counsellor with this email already exists' });
        }
        res.status(error.status || 500).json({
            message: error.status ? error.message : 'Failed to create counsellor',
            error: error.message
        });
    }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED_FIELDS = ['first_name', 'last_name', 'email', 'phone'];
const OPTIONAL_FIELDS = [
    'alternate_phone', 'qualification', 'experience_years', 'state', 'notes',
    'designation', 'ratings', 'response_rate', 'career_development',
];

const updateCounsellor = async (req, res) => {
    const { id } = req.params;
    let newImagePath = null;
    try {
        if (!UUID_PATTERN.test(id)) {
            return res.status(400).json({ message: 'Invalid counsellor id' });
        }

        const current = await pool.query('SELECT uuid, profile_img FROM counsellors WHERE uuid = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ message: 'Counsellor not found' });
        }
        const oldImagePath = current.rows[0].profile_img;

        const sets = [];
        const values = [];
        const setField = (column, value) => {
            values.push(value);
            sets.push(`${column} = $${values.length}`);
        };

        for (const field of REQUIRED_FIELDS) {
            if (req.body[field] === undefined) continue;
            const value = String(req.body[field]).trim();
            if (!value) {
                return res.status(400).json({ message: `${field.replace('_', ' ')} cannot be empty` });
            }
            setField(field, field === 'email' ? value.toLowerCase() : value);
        }

        for (const field of OPTIONAL_FIELDS) {
            if (req.body[field] === undefined) continue;
            setField(field, normalizeOptionalField(field, req.body[field]));
        }

        if (req.body.status !== undefined) {
            setField('status', req.body.status === true || req.body.status === 'true');
        }

        if (req.body.email !== undefined) {
            const duplicate = await pool.query(
                'SELECT 1 FROM counsellors WHERE email = $1 AND uuid <> $2',
                [String(req.body.email).trim().toLowerCase(), id]
            );
            if (duplicate.rows.length > 0) {
                return res.status(400).json({ message: 'Counsellor with this email already exists' });
            }
        }

        const removeImage = req.body.remove_profile_img === true || req.body.remove_profile_img === 'true';
        if (req.file) {
            newImagePath = await saveCounsellorImageAsWebp(req.file);
            setField('profile_img', newImagePath);
        } else if (removeImage) {
            setField('profile_img', null);
        }

        if (sets.length === 0) {
            return res.status(400).json({ message: 'Nothing to update' });
        }

        values.push(id);
        const updated = await pool.query(
            `UPDATE counsellors SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE uuid = $${values.length}
             RETURNING ${COUNSELLOR_COLUMNS}`,
            values
        );

        if ((req.file || removeImage) && oldImagePath && oldImagePath !== newImagePath) {
            await removeCounsellorImage(oldImagePath);
        }

        res.status(200).json({
            message: 'Counsellor updated successfully',
            counsellor: updated.rows[0]
        });
    } catch (error) {
        if (newImagePath) await removeCounsellorImage(newImagePath);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Counsellor with this email already exists' });
        }
        res.status(error.status || 500).json({
            message: error.status ? error.message : 'Failed to update counsellor',
            error: error.message
        });
    }
}


const getAllCounsellors = async (req, res) => {
  try {
      const query = `
          SELECT
              c.*,
              COALESCE(
                  (
                      SELECT jsonb_agg(
                          jsonb_build_object(
                              'id', sct.id,
                              'title', sct.title,
                              'sort_order', sct.sort_order,
                              'specialization_uuid', sct.specialization_uuid,
                              'course_id', sct.course_id,
                              'created_at', sct.created_at,
                              'updated_at', sct.updated_at,
                              'rows', COALESCE(
                                  (
                                      SELECT jsonb_agg(
                                          jsonb_build_object(
                                              'id', scr.id,
                                              'table_id', scr.table_id,
                                              'label', scr.label,
                                              'content', scr.content,
                                              'sort_order', scr.sort_order,
                                              'created_at', scr.created_at,
                                              'updated_at', scr.updated_at
                                          )
                                          ORDER BY scr.sort_order ASC
                                      )
                                      FROM specialization_content_rows scr
                                      WHERE scr.table_id = sct.id
                                        AND scr.counsellor_id = c.uuid
                                  ),
                                  '[]'::jsonb
                              )
                          )
                          ORDER BY sct.sort_order ASC
                      )
                      FROM specialization_content_tables sct
                      WHERE sct.counsellor_id = c.uuid
                  ),
                  '[]'::jsonb
              ) AS specialization_content_tables
          FROM counsellors c
          ORDER BY c.created_at DESC;
      `;

      const counsellors = await pool.query(query);

      res.status(200).json({
          message: 'Counsellors fetched successfully',
          counsellors: counsellors.rows
      });
  } catch (error) {
      console.error('Error fetching counsellors:', error);

      res.status(500).json({
          message: 'Failed to fetch counsellors',
          error: error.message
      });
  }
};




const getCounsellorById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({ message: 'Invalid counsellor id' });
    }

    const query = `
      SELECT
        c.*,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', sct.id,
                'title', sct.title,
                'sort_order', sct.sort_order,
                'specialization_uuid', sct.specialization_uuid,
                'course_id', sct.course_id,
                'created_at', sct.created_at,
                'updated_at', sct.updated_at,
                'rows', COALESCE(
                  (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'id', scr.id,
                        'table_id', scr.table_id,
                        'label', scr.label,
                        'content', scr.content,
                        'sort_order', scr.sort_order,
                        'created_at', scr.created_at,
                        'updated_at', scr.updated_at
                      )
                      ORDER BY scr.sort_order ASC
                    )
                    FROM specialization_content_rows scr
                    WHERE scr.table_id = sct.id
                      AND scr.counsellor_id = c.uuid
                  ),
                  '[]'::jsonb
                )
              )
              ORDER BY sct.sort_order ASC
            )
            FROM specialization_content_tables sct
            WHERE sct.counsellor_id = c.uuid
          ),
          '[]'::jsonb
        ) AS specialization_content_tables
      FROM counsellors c
      WHERE c.uuid = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Counsellor not found'
      });
    }

    res.status(200).json({
      message: 'Counsellor fetched successfully',
      counsellor: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching counsellor:', error);

    res.status(500).json({
      message: 'Failed to fetch counsellor',
      error: error.message
    }); 
  }
};


const creatParagraphsForCounsellors = async (req, res) => {
    try {
      const { counsellors } = req.body;
  
      if (!Array.isArray(counsellors) || counsellors.length === 0) {
        return res.status(400).json({
          message: "Counsellors array is required"
        });
      }
  
      const values = [];
      const placeholders = [];
  
      counsellors.forEach((item, index) => {
        const { title, content, sort_order } = item;
  
        if (!title || !content || sort_order === undefined) {
          throw new Error(
            `Invalid data at index ${index}: title, content and sort_order are required`
          );
        }
  
        const baseIndex = index * 3;
  
        placeholders.push(
          `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`
        );
  
        values.push(title, content, sort_order);
      });
  
      const query = `
        INSERT INTO specialization_content_paragraphs
          (title, content, sort_order)
        VALUES
          ${placeholders.join(", ")}
        RETURNING *;
      `;
  
      const result = await pool.query(query, values);
  
      return res.status(201).json({
        message: "Counsellors created successfully",
        count: result.rows.length,
        data: result.rows
      });
  
    } catch (error) {
      console.error(error);
  
      return res.status(500).json({
        message: "Failed to create counsellors",
        error: error.message
      });
    }
};

const createContentForCounsellors = async (req,res)=>{
    try {
        const {
            counsellor_id,
            title,
            content,
            sort_order = 0,
          } = req.body;
      
          if (!counsellor_id || !content || !String(content).trim()) {
            return res.status(400).json({
              success: false,
              message: 'counsellor_id and content are required',
            });
          }
      
          const result = await pool.query(
            `
            INSERT INTO specialization_content_paragraphs
              (counsellor_id, title, content, sort_order)
            VALUES
              ($1, $2, $3, $4)
            RETURNING *
            `,
            [counsellor_id, title || null, String(content).trim(), Number(sort_order) || 0]
          );
      
          return res.status(201).json({
            success: true,
            message: 'Content paragraph created successfully',
            data: result.rows[0],
          });
        
    } catch (error) {
        res.status(500).json({
            message: 'Failed to create paragraph',
            error: error.message
        });
    }
}

const createTableForCounsellor = async (req, res) => {
    try {
      const {
        counsellor_id,
        title,
        sort_order = 0,
      } = req.body;
  
    
  
      if (!counsellor_id) {
        return res.status(400).json({
          success: false,
          message: 'counsellor_id is required',
        });
      }
  
      const result = await pool.query(
        `
        INSERT INTO specialization_content_tables
          (counsellor_id, title, sort_order)
        VALUES
          ($1, $2, $3)
        RETURNING *
        `,
        [counsellor_id, title || null, Number(sort_order) || 0]
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

const createRowsForCounsellor = async (req, res) => {
    try {
        const {
            table_id,
            label,
            content,
            sort_order = 0,
        } = req.body;

        if (!table_id || !label || !content || typeof content !== 'object' || Array.isArray(content)) {
            return res.status(400).json({
                success: false,
                message: 'table_id, label and content ({ column: value }) are required',
            });
        }

        const result = await pool.query(
            `
            INSERT INTO specialization_content_rows
              (table_id, counsellor_id, label, content, sort_order)
            SELECT id, counsellor_id, $2, $3::jsonb, $4
            FROM specialization_content_tables
            WHERE id = $1
            RETURNING *
            `,
            [table_id, String(label), JSON.stringify(content), Number(sort_order) || 0]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Table not found',
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Rows created successfully',
            data: result.rows[0],
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to create rows',
            error: error.message
        });
    }
}
  


const getContentParagraphsByCounsellor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({ message: 'Invalid counsellor id' });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM specialization_content_paragraphs
      WHERE counsellor_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [id]
    );
    return res.status(200).json({
      success: true,
      message: 'Content paragraphs fetched successfully',
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching content paragraphs:', error);
    return res.status(500).json({ message: 'Failed to fetch content paragraphs', error: error.message });
  }
}


const getContentTablesByCourse = async (req, res) => {
  try {
    const counsellorId =
      req.query.counsellor_id ||
      req.params.counsellorId ||
      (req.params.id && !req.params.courseId ? req.params.id : null) ||
      null;
    const courseId = counsellorId
      ? req.query.course_id || null
      : req.params.courseId || req.query.course_id || null;

    if (!courseId && !counsellorId) {
      return res.status(400).json({
        success: false,
        message: "courseId or counsellor_id is required",
      });
    }

    const sql = courseId
      ? `SELECT *
         FROM specialization_content_tables
         WHERE course_id = $1
         ORDER BY sort_order ASC, created_at ASC`
      : `SELECT *
         FROM specialization_content_tables
         WHERE counsellor_id = $1
         ORDER BY sort_order ASC, created_at ASC`;

    const tablesResult = await pool.query(sql, [courseId || counsellorId]);
    const tables = [];

    for (const table of tablesResult.rows) {
      const rowsResult = await pool.query(
        `SELECT *
         FROM specialization_content_rows
         WHERE table_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
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
    console.error("Get content tables error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch content tables",
      error: error.message,
    });
  }
};

const getContentRow = async (req, res) => {
  try {
    const id = req.params.id || req.query.counsellor_id || req.query.table_id;
    const tableId = req.query.table_id || null;

    if (!id || !UUID_PATTERN.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid counsellor id or table_id is required',
      });
    }

    const result = await pool.query(
      tableId || req.query.table_id
        ? `
          SELECT
            id,
            table_id,
            label,
            content,
            sort_order,
            created_at,
            updated_at,
            counsellor_id
          FROM specialization_content_rows
          WHERE table_id = $1
          ORDER BY sort_order ASC, created_at ASC
        `
        : `
          SELECT
            id,
            table_id,
            label,
            content,
            sort_order,
            created_at,
            updated_at,
            counsellor_id
          FROM specialization_content_rows
          WHERE counsellor_id = $1
          ORDER BY sort_order ASC, created_at ASC
        `,
      [tableId || id]
    );

    return res.status(200).json({
      success: true,
      message: 'Content rows fetched successfully',
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get content row error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch content rows',
      error: error.message,
    });
  }
};

const deleteContentTableByCounsellor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Table id is required',
      });
    }

    const result = await pool.query(
      `
      DELETE FROM specialization_content_tables
      WHERE id::text = $1
        AND counsellor_id IS NOT NULL
      RETURNING *
      `,
      [String(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Content table not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Content table deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Delete content table error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete content table',
      error: error.message,
    });
  }
};

module.exports = {
  createCounsellor,
  updateCounsellor,
  getAllCounsellors,
  getCounsellorById,
  createContentForCounsellors,
  createTableForCounsellor,
  getContentParagraphsByCounsellor,
  createRowsForCounsellor,
  getContentTablesByCourse,
  getContentTable: getContentTablesByCourse,
  getContentRow,
  deleteContentTableByCounsellor,
};