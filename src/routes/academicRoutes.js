const express = require('express');
const universityController = require('../controllers/universityController');
const courseController = require('../controllers/courseController');
const specializationController = require('../controllers/specializationController');
const authenticate = require('../middleware/auth');

const academicRouter = express.Router();

// academicRouter.use(authenticate);

academicRouter.get('/universities', universityController.getUniversities);
academicRouter.post('/universities', universityController.createUniversity);

academicRouter.post('/courses-fees', specializationController.createCourseFee);
academicRouter.get('/course-fees', specializationController.getCourseFeesBySpecialization);
// academicRouter.get('/courses-fees/specialization/:specialization_id', specializationController.getCourseFeesBySpecialization);
academicRouter.put('/courses-fees/:uuid', specializationController.updateCourseFee);
academicRouter.delete('/courses-fees/:uuid', specializationController.deleteCourseFee);


academicRouter.post('/courses', courseController.createCourse);
academicRouter.get('/courses', courseController.getCourses);
academicRouter.get('/courses/:uuid', courseController.getCourseById);
academicRouter.put('/courses/:uuid', courseController.updateCourse);
academicRouter.delete('/courses/:uuid', courseController.deleteCourse);

// academicRouter.post('/courses-specilizations', courseController.createCourseSpecializations);

academicRouter.get('/specializations', specializationController.getSpecializations);
academicRouter.post('/specializations', specializationController.createSpecialization);
academicRouter.put('/specializations/:uuid', specializationController.updateSpecialization);
academicRouter.delete('/specializations/:uuid', specializationController.deleteSpecialization);

// academicRouter.get('/university-specializations', specializationController.getUniversitySpecializations);
// academicRouter.post('/university-specializations', specializationController.universitySpecilization);



module.exports = academicRouter;
