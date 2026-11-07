const express = require("express");
const { companies } = require("../../data/companies");

const companiesRouter = express.Router();

companiesRouter.get("/get", (req, res) => {
    res.status(200).json({
        message: "Companies data fetched successfully",
        data: companies
    });
});

module.exports = companiesRouter;