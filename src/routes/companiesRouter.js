const express = require("express");
const { companies } = require("../../data/companies");

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

// module.exports = router;

module.exports = companiesRouter;