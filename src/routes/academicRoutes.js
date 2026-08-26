const express = require('express');
const universityController = require('../controllers/universityController');
const courseController = require('../controllers/courseController');
const specializationController = require('../controllers/specializationController');
const authenticate = require('../middleware/auth');

const academicRouter = express.Router();

academicRouter.use(authenticate);

academicRouter.get('/universities', universityController.getUniversities);
academicRouter.post('/universities', universityController.createUniversity);
academicRouter.get('/courses', courseController.getCourses);
academicRouter.post('/courses', courseController.createCourse);
academicRouter.post('/specializations', specializationController.createSpecialization);

module.exports = academicRouter;
