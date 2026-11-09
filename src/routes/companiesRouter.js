const express = require("express");
const { companies } = require("../../data/companies");
const { pool } = require("../config/db");

const companiesRouter = express.Router();



companiesRouter.post("/create", async (req, res) => {
    try {
        const { company_name, website, logo } = req.body;

        if (!company_name) {
            return res.status(400).json({
                success: false,
                message: "Company name is required",
            });
        }

        const result = await pool.query(
            `INSERT INTO university_reference_companies
            (company_name, website, logo)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [company_name, website || null, logo || null]
        );

        res.status(201).json({
            success: true,
            message: "Company created successfully",
            data: result.rows[0],
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});


// GET ALL COMPANIES
companiesRouter.get("/get", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM university_reference_companies
             ORDER BY id DESC`
        );

        res.status(200).json({
            success: true,
            total: result.rowCount,
            data: result.rows,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});


// GET COMPANY BY ID
companiesRouter.get("/get/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM university_reference_companies WHERE id = $1`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Company not found",
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0],
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});


// UPDATE COMPANY
companiesRouter.put("/update/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { company_name, website, logo } = req.body;

        const fields = {
            company_name,
            website,
            logo,
        };

        const updates = [];
        const values = [];

        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined) {
                values.push(value);
                updates.push(`${key} = $${values.length}`);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide fields to update",
            });
        }

        values.push(id);

        const result = await pool.query(
            `UPDATE university_reference_companies
             SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${values.length}
             RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Company not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Company updated successfully",
            data: result.rows[0],
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});


// DELETE COMPANY
companiesRouter.delete("/delete/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM university_reference_companies
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Company not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Company deleted successfully",
            data: result.rows[0],
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});


companiesRouter.get("/fetch-companies-by-id", async (req, res) => {
    try {
        const { university_id } = req.query;

        if (!university_id) {
            return res.status(400).json({
                success: false,
                message: "University ID is required",
            });
        }

        const query = `
            SELECT
                c.uuid,
                c.company_name,
                c.website,
                c.logo,
                m.created_at AS mapped_at
            FROM university_company_mapping m
            INNER JOIN university_reference_companies c
                ON c.uuid = m.company_uuid
            INNER JOIN universities u
                ON u.uuid = m.university_uuid
            WHERE u.uuid = $1
            ORDER BY c.company_name ASC
        `;

        const result = await pool.query(query, [university_id]);

        return res.status(200).json({
            success: true,
            message: "Companies fetched successfully",
            total: result.rowCount,
            data: result.rows,
        });

    } catch (error) {
        console.error("Get companies by university error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

companiesRouter.post('/assign-companies-to-universities', async (req, res) => {
    try {
        const { university_id, company_ids } = req.body;

        // Validation
        if (!university_id || !Array.isArray(company_ids) || company_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "University ID and Company IDs are required"
            });
        }

        // Remove duplicate company IDs
        const uniqueCompanyIds = [...new Set(company_ids)];

        // Generate placeholders dynamically
        const values = [];
        const placeholders = uniqueCompanyIds.map((company_id, index) => {
            values.push(university_id, company_id);

            const universityIndex = index * 2 + 1;
            const companyIndex = index * 2 + 2;

            return `($${universityIndex}, $${companyIndex})`;
        });

        const query = `
            INSERT INTO university_company_mapping
            (university_uuid, company_uuid)
            VALUES ${placeholders.join(", ")}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        return res.status(201).json({
            success: true,
            message: "Companies assigned to university successfully",
            total_assigned: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error("Assign companies error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
});
// module.exports = companiesRouter;
module.exports = companiesRouter;