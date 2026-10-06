const express = require('express');
const counsellorRoutes = express.Router();
const counsellorController = require('../controllers/counsellorsController');
counsellorRoutes.get('/', counsellorController.getAllCounsellors);
counsellorRoutes.post('/', counsellorController.createCounsellor);
counsellorRoutes.post('/counsellor-paragraphs', counsellorController.createContentForCounsellors);
counrsellorRoutes.post('/counsellor-table', counsellorController.createTableForCounsellor);
counrsellorRoutes.post('/counsellor-rows', counsellorController.createRowsForCounsellor);
module.exports = counsellorRoutes;