
const express = require("express");
const { companies } = require("../../data/companies");
const companiesRouter = express.Router();

companiesRouter.get("/get",(res,req)=>{
    res.send({
   message : "companies data fetching",
   data:companies
    })
})


module.exports = companiesRouter     ;
