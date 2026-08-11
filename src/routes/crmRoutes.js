const express = require('express');
const crmController = require('../controllers/crmController');
const resourceController = require('../controllers/crmResourceController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

const crmRoles = ['admin', 'super_admin', 'manager', 'counselor', 'sales'];

router.use(authenticate);
router.use(authorize(...crmRoles, 'user'));

router.get('/dashboard', crmController.getDashboard);

router.get('/leads', crmController.getLeads);
router.get('/leads/:id', crmController.getLead);
router.post('/leads', crmController.createLead);
router.put('/leads/:id', crmController.updateLead);
router.delete('/leads/:id', authorize('admin', 'super_admin', 'manager'), crmController.deleteLead);
router.post('/leads/bulk', authorize('admin', 'super_admin', 'manager'), crmController.bulkUpdateLeads);
router.get('/leads/:id/activities', crmController.getActivities);
router.get('/leads/:id/notes', crmController.getNotes);
router.post('/leads/:id/notes', crmController.addNote);
router.post('/leads/:id/convert', crmController.convertLead);

router.get('/followups', resourceController.getFollowups);
router.post('/followups', resourceController.createFollowup);
router.put('/followups/:id', resourceController.updateFollowup);

router.get('/tasks', resourceController.getTasks);
router.post('/tasks', resourceController.createTask);
router.put('/tasks/:id', resourceController.updateTask);

router.get('/counselors', resourceController.getCounselors);
router.get('/counselors/:id', resourceController.getCounselor);

router.get('/applications', resourceController.getApplications);
router.post('/applications', resourceController.createApplication);
router.put('/applications/:id', resourceController.updateApplication);

router.get('/admissions', resourceController.getAdmissions);
router.get('/reports', resourceController.getReports);

module.exports = router;
