const express = require('express');
const universityController = require('../controllers/universityController');
const courseController = require('../controllers/courseController');
const specializationController = require('../controllers/specializationController');
const authenticate = require('../middleware/auth');

const academicRouter = express.Router();

// academicRouter.use(authenticate);

academicRouter.get('/universities', universityController.getUniversities);
academicRouter.post('/universities', universityController.createUniversity);

// academicRouter.get('/courses', courseController.getCourses);
academicRouter.post('/courses', courseController.createCourse);
academicRouter.get('/courses/:uuid', courseController.getCourseById);
academicRouter.put('/courses/:uuid', courseController.updateCourse);
academicRouter.delete('/courses/:uuid', courseController.deleteCourse);

academicRouter.get('/courses', courseController.getCourses);
academicRouter.post('/courses-specilizations', courseController.createCourseSpecializations);

academicRouter.get('/specializations', specializationController.getSpecializations);
academicRouter.post('/specializations', specializationController.createSpecialization);
academicRouter.put('/specializations/:uuid', specializationController.updateSpecialization);
academicRouter.delete('/specializations/:uuid', specializationController.deleteSpecialization);

// academicRouter.get('/university-specializations', specializationController.getUniversitySpecializations);
// academicRouter.post('/university-specializations', specializationController.universitySpecilization);



module.exports = academicRouter;
