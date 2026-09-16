const express = require('express');
const universityController = require('../controllers/universityController');
const courseController = require('../controllers/courseController');
const specializationController = require('../controllers/specializationController');
const universityApprovalsControllers = require('../controllers/university.approvalsControllers');
const { uploadApprovalLogo } = require('../middleware/uploadApprovalLogo');
const authenticate = require('../middleware/auth');
const universityFaqsControllers = require('../controllers/universities_faqs');
const { uploadUniversityMedia } = require('../middleware/uploadUniversityMedia');
const academicRouter = express.Router();

// academicRouter.use(authenticate);

const handleUniversityMediaUpload = (req, res, next) => {
  uploadUniversityMedia(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Image must be under 2MB',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid image upload',
    });
  });
};

academicRouter.get('/universities', universityController.getUniversities);
academicRouter.post(
  '/universities',
  handleUniversityMediaUpload,
  universityController.createUniversity
);
academicRouter.put(
  '/universities/:id',
  handleUniversityMediaUpload,
  universityController.updateUniversity
);
academicRouter.delete('/universities/:uuid', universityController.deleteUniversity);
academicRouter.post('/courses-fees', specializationController.createCourseFee);
academicRouter.get('/course-fees', specializationController.getCourseFeesBySpecialization);
academicRouter.put('/courses-fees/:uuid', specializationController.updateCourseFee);
academicRouter.delete('/courses-fees/:uuid', specializationController.deleteCourseFee);

academicRouter.post('/course-tables', specializationController.createContentTable);
academicRouter.post('/course-table-rows', specializationController.createContentRow);
academicRouter.get('/course-tables/:courseId', specializationController.getContentTablesByCourse);
academicRouter.delete('/course-tables/by-course/:courseId', specializationController.deleteContentTablesByParent);

academicRouter.post('/course-table-paragraphs', courseController.createContentParagraph);
academicRouter.get('/course-table-paragraphs/:courseId', courseController.getContentParagraphsByCourse);

academicRouter.post('/specialization-tables', specializationController.createContentTable);
academicRouter.post('/specialization-table-rows', specializationController.createContentRow);
academicRouter.get('/specialization-tables/:specializationId', specializationController.getContentTablesByCourse);
academicRouter.delete('/specialization-tables/by-specialization/:specializationId', specializationController.deleteContentTablesByParent);
academicRouter.post('/specialization-table-paragraphs', specializationController.createContentParagraph);
academicRouter.get('/specialization-table-paragraphs/:specializationId', specializationController.getContentParagraphsBySpecialization);
academicRouter.delete('/specialization-table-paragraphs/by-specialization/:specializationId', specializationController.deleteContentParagraphsByParent);
academicRouter.post('/courses', courseController.createCourse);
academicRouter.get('/courses', courseController.getCourses);
academicRouter.get('/courses/:uuid', courseController.getCourseById);
academicRouter.put('/courses/:uuid', courseController.updateCourse);
academicRouter.delete('/courses/:uuid', courseController.deleteCourse);
academicRouter.post('/courses-faqs', courseController.createFaq);
academicRouter.get('/courses-faqs/:courseId', courseController.getFaqsByCourse);


// academicRouter.post('/courses-specilizations', courseController.createCourseSpecializations);

academicRouter.get('/specializations', specializationController.getSpecializations);
academicRouter.post('/specializations', specializationController.createSpecialization);
academicRouter.put('/specializations/:uuid', specializationController.updateSpecialization);
academicRouter.delete('/specializations/:uuid', specializationController.deleteSpecialization);

// academicRouter.get('/university-specializations', specializationController.getUniversitySpecializations);
// academicRouter.post('/university-specializations', specializationController.universitySpecilization);

const handleApprovalLogoUpload = (req, res, next) => {
  uploadApprovalLogo(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Image must be under 2MB',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid image upload',
    });
  });
};

academicRouter.get('/university-approvals/detail/:id', universityApprovalsControllers.getUniversityApprovalById);
academicRouter.get('/university-approvals/:universityId', universityApprovalsControllers.getUniversityApprovals);
academicRouter.post(
  '/university-approvals',
  handleApprovalLogoUpload,
  universityApprovalsControllers.createUniversityApproval
);
academicRouter.put(
  '/university-approvals/:id',
  handleApprovalLogoUpload,
  universityApprovalsControllers.updateUniversityApproval
);
academicRouter.delete('/university-approvals/:id', universityApprovalsControllers.deleteUniversityApproval);



  academicRouter.post('/university-faqs', universityFaqsControllers.createFaq);
academicRouter.get('/university-faqs/:universityId', universityFaqsControllers.getFaqsByUniversity);
academicRouter.get('/university-faqs/detail/:id', universityFaqsControllers.getFaqById);
academicRouter.put('/university-faqs/:id', universityFaqsControllers.updateFaq);
academicRouter.delete('/university-faqs/:id', universityFaqsControllers.deleteFaq);

module.exports = academicRouter;
