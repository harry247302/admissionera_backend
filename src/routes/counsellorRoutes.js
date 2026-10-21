const express = require('express');
const counsellorRoutes = express.Router();
const counsellorController = require('../controllers/counsellorsController');
const { uploadCounsellorImage } = require('../middleware/uploadCounsellorImage');

counsellorRoutes.get('/', counsellorController.getAllCounsellors);
counsellorRoutes.get('/counsellor-table-paragraphs/:id', counsellorController.getContentParagraphsByCounsellor);
counsellorRoutes.get('/counsellor-tables/:id', counsellorController.getContentTablesByCourse);
counsellorRoutes.get('/counsellor-table/:courseId', counsellorController.getContentTablesByCourse);
counsellorRoutes.get('/counsellor-rows/:id', counsellorController.getContentRow);
counsellorRoutes.get('/:id', counsellorController.getCounsellorById);
counsellorRoutes.post('/', uploadCounsellorImage, counsellorController.createCounsellor);
counsellorRoutes.put('/:id', uploadCounsellorImage, counsellorController.updateCounsellor);
counsellorRoutes.post('/counsellor-paragraphs', counsellorController.createContentForCounsellors);
counsellorRoutes.post('/counsellor-table', counsellorController.createTableForCounsellor);
counsellorRoutes.post('/counsellor-rows', counsellorController.createRowsForCounsellor);
counsellorRoutes.delete('/counsellor-tables/:id', counsellorController.deleteContentTableByCounsellor);

module.exports = counsellorRoutes;
