const { pool } = require('../config/db');
const {
  saveApprovalLogoAsWebp,
  removeUploadedFile,
} = require('../middleware/uploadApprovalLogo');

const createUniversityApproval = async (req, res) => {
  try {
    const {
      university_id,
      approval_name,
      approval_description,
      display_order,
      is_active,
    } = req.body;

    if (!university_id) {
      return res.status(400).json({
        success: false,
        message: 'University ID is required',
      });
    }

    if (!approval_name) {
      return res.status(400).json({
        success: false,
        message: 'Approval name is required',
      });
    }

    const universityResult = await pool.query(
      'SELECT uuid FROM universities WHERE uuid = $1',
      [university_id]
    );

    if (universityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'University not found',
      });
    }

    let approvalLogoPath = null;
    if (req.file) {
      approvalLogoPath = await saveApprovalLogoAsWebp(req.file);
    } else if (req.body.approval_logo) {
      // Allow optional pre-existing URL/path when no file is uploaded
      approvalLogoPath = req.body.approval_logo;
    }

    const result = await pool.query(
      `INSERT INTO university_approvals
      (
        university_id,
        approval_name,
        approval_logo,
        approval_description,
        display_order,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        university_id,
        approval_name,
        approvalLogoPath,
        approval_description || null,
        display_order ?? 0,
        is_active === undefined
          ? true
          : is_active === true || is_active === 'true' || is_active === '1',
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'University approval created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create university approval error:', error);

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create university approval',
      error: error.message,
    });
  }
};

const getUniversityApprovals = async (req, res) => {
  try {
    const { universityId } = req.params;

    const result = await pool.query(
      `SELECT *
       FROM university_approvals
       WHERE university_id = $1
       AND is_active = true
       ORDER BY display_order ASC, created_at ASC`,
      [universityId]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get university approvals error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch university approvals',
      error: error.message,
    });
  }
};

const getUniversityApprovalById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT *
       FROM university_approvals
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'University approval not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get university approval error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch university approval',
      error: error.message,
    });
  }
};

const updateUniversityApproval = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      approval_name,
      approval_description,
      display_order,
      is_active,
    } = req.body;

    const existingApproval = await pool.query(
      `SELECT *
       FROM university_approvals
       WHERE id = $1`,
      [id]
    );

    if (existingApproval.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'University approval not found',
      });
    }

    const current = existingApproval.rows[0];
    let approvalLogoPath = current.approval_logo;

    if (req.file) {
      approvalLogoPath = await saveApprovalLogoAsWebp(req.file);
      if (current.approval_logo && current.approval_logo !== approvalLogoPath) {
        await removeUploadedFile(current.approval_logo);
      }
    } else if (req.body.approval_logo !== undefined) {
      approvalLogoPath = req.body.approval_logo || null;
    }

    let nextActive = current.is_active;
    if (is_active !== undefined) {
      nextActive = is_active === true || is_active === 'true' || is_active === '1';
    }

    const result = await pool.query(
      `UPDATE university_approvals
       SET
         approval_name = $1,
         approval_logo = $2,
         approval_description = $3,
         display_order = $4,
         is_active = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        approval_name ?? current.approval_name,
        approvalLogoPath,
        approval_description !== undefined
          ? approval_description || null
          : current.approval_description,
        display_order ?? current.display_order,
        nextActive,
        id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'University approval updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update university approval error:', error);

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update university approval',
      error: error.message,
    });
  }
};

const deleteUniversityApproval = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM university_approvals
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'University approval not found',
      });
    }

    await removeUploadedFile(result.rows[0].approval_logo);

    return res.status(200).json({
      success: true,
      message: 'University approval deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Delete university approval error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete university approval',
      error: error.message,
    });
  }
};

module.exports = {
  createUniversityApproval,
  getUniversityApprovals,
  getUniversityApprovalById,
  updateUniversityApproval,
  deleteUniversityApproval,
};
