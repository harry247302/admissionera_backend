const { pool } = require("../config/db");

const createCounsellor = async (req, res) => {
   try {
    const { first_name, last_name, phone,email} = req.body;
    // validation
    if(!first_name || !last_name || !phone || !email) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    // check if counsellor already exists
   const checkCounsellor = await pool.query('SELECT * FROM counsellors WHERE email = $1 and phone = $2', [email, phone]);
   if(checkCounsellor.rows.length > 0) {
    return res.status(400).json({ message: 'Counsellor already exists' });
   }
   // create counsellor
   const newCounsellor = await pool.query('INSERT INTO counsellors (first_name, last_name, phone, email) VALUES ($1, $2, $3, $4) RETURNING *', [first_name, last_name, phone, email]);
  

   res.status(201).json({
    message: 'Counsellor created successfully',
    counsellor: newCounsellor.rows[0]
   });
   } catch (error) {
        res.status({
            message: 'Failed to create counsellor',
            error: error.message
        })
   }
}

const getAllCounsellors = async (req, res) => {
    const counsellors = await pool.query('SELECT * FROM counsellors');
    res.status(200).json({
        message: 'Counsellors fetched successfully',
        counsellors: counsellors.rows
    });
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
  
module.exports = { createCounsellor, getAllCounsellors, createContentForCounsellors, createTableForCounsellor, createRowsForCounsellor };