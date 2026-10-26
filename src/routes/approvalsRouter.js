const express = require('express');
const approvalsRouter = express.Router();

approvalsRouter.get('/get-approvals', (req, res) => {
    const approvals = ["aicte-logo.jpg","aiu-logo.jpg","iso-logo.jpg","logo-naac-a-plus-plus.jpg","nirf-logo.jpg","ugc-deb-logo.jpg","wes-logo.jpg"]
    res.send({data:approvals,status:200,message:"Approvals fetched successfully"})
});

module.exports = approvalsRouter;
