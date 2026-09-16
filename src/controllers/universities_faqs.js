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


module.exports = {
  createFaq,
  getFaqsByUniversity,
  getFaqById,
  updateFaq,
  deleteFaq,
};