const { pool } = require("../config/db");
const {
    saveCounsellorImageAsWebp,
    removeCounsellorImage,
} = require('../middleware/uploadCounsellorImage');

const COUNSELLOR_COLUMNS = `uuid, first_name, last_name, email, phone, alternate_phone, status,
    profile_img, notes, qualification, experience_years, state, created_at, updated_at`;



const createCounsellor = async (req, res) => {
  const { first_name, last_name, phone, email, alternate_phone, qualification, experience_years, state, notes } = req.body;
    let profileImgPath = null;
    try {
    
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
                 experience_years, state, notes, profile_img)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING ${COUNSELLOR_COLUMNS}`,
            [first_name, last_name, phone, email, alternate_phone, qualification,
             experience_years, state, notes, profileImgPath]
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
const OPTIONAL_FIELDS = ['alternate_phone', 'qualification', 'experience_years', 'state', 'notes'];

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
            const value = req.body[field] === null ? '' : String(req.body[field]).trim();
            if (field === 'experience_years' && value) {
                const years = Number(value);
                if (!Number.isInteger(years) || years < 0 || years > 60) {
                    return res.status(400).json({ message: 'Experience must be a whole number between 0 and 60' });
                }
                setField(field, years);
                continue;
            }
            setField(field, value ? (field === 'state' ? value.toUpperCase() : value) : null);
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
        const counsellors = await pool.query(
            `SELECT ${COUNSELLOR_COLUMNS} FROM counsellors ORDER BY created_at DESC`
        );
        res.status(200).json({
            message: 'Counsellors fetched successfully',
            counsellors: counsellors.rows
        });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to fetch counsellors',
            error: error.message
        });
    }
}

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
            sort_order = 0,
          } = req.body;
      
          const counsellorRef = counsellor_id || null;
      
          if (!counsellorRef) {
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
            [counsellor_id, title, sort_order]
          );
      
          return res.status(201).json({
            success: true,
            message: 'Content paragraph created successfully',
            data: result.rows[0],
          });
        
    } catch (error) {
        res.status(500).json({
            message: 'Failed to create table',
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
        [counsellor_id, title, sort_order]
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
            value,
            sort_order = 0,
        } = req.body;

        if (!table_id || !label || !value) {
            return res.status(400).json({
                success: false,
                message: 'table_id, label and value are required',
            });
        }

        const result = await pool.query(
            `
            INSERT INTO specialization_content_rows
              (table_id, label, value, sort_order)
            VALUES
              ($1, $2, $3, $4)
            RETURNING *
            `,
            [table_id, label, value, sort_order]
        );

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
  
module.exports = { createCounsellor, updateCounsellor, getAllCounsellors, createContentForCounsellors, createTableForCounsellor, createRowsForCounsellor };