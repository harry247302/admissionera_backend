const Followup = require('../models/Followup');
const Task = require('../models/Task');
const Counselor = require('../models/Counselor');
const Application = require('../models/Application');
const Admission = require('../models/Admission');

const toCamel = (obj) => {
  if (!obj) return obj;
  const map = {
    lead_id: 'leadId', lead_name: 'leadName', lead_code: 'leadCode',
    counselor_id: 'counselorId', counselor_name: 'counselorName',
    followup_date: 'followupDate', followup_time: 'followupTime',
    followup_type: 'followupType', assigned_to: 'assignedTo',
    assigned_to_name: 'assignedToName', due_date: 'dueDate',
    application_code: 'applicationCode', application_date: 'applicationDate',
    documents_status: 'documentsStatus', payment_status: 'paymentStatus',
    assigned_counselor_id: 'assignedCounselorId',
    admission_code: 'admissionCode', admission_date: 'admissionDate',
    admission_source: 'admissionSource', application_id: 'applicationId',
    user_id: 'userId', is_active: 'isActive', total_leads: 'totalLeads',
    active_leads: 'activeLeads', converted_leads: 'convertedLeads',
    followups_today: 'followupsToday', conversion_rate: 'conversionRate',
    created_at: 'createdAt', updated_at: 'updatedAt', created_by: 'createdBy',
  };
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[map[k] || k] = v;
  }
  return result;
};

const getFollowups = async (req, res) => {
  try {
    const result = await Followup.findAll(req.query);
    res.json({ followups: result.followups.map(toCamel), pagination: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch follow-ups' });
  }
};

const createFollowup = async (req, res) => {
  try {
    const followup = await Followup.create(req.body, req.user.id);
    res.status(201).json({ message: 'Follow-up scheduled', followup: toCamel(followup) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create follow-up' });
  }
};

const updateFollowup = async (req, res) => {
  try {
    const followup = await Followup.update(req.params.id, req.body);
    if (!followup) return res.status(404).json({ message: 'Follow-up not found' });
    res.json({ message: 'Follow-up updated', followup: toCamel(followup) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update follow-up' });
  }
};

const getTasks = async (req, res) => {
  try {
    const result = await Task.findAll(req.query);
    res.json({ tasks: result.tasks.map(toCamel), pagination: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
};

const createTask = async (req, res) => {
  try {
    const task = await Task.create(req.body, req.user.id);
    res.status(201).json({ message: 'Task created', task: toCamel(task) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create task' });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.update(req.params.id, req.body);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task updated', task: toCamel(task) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update task' });
  }
};

const getCounselors = async (_req, res) => {
  try {
    const counselors = await Counselor.findAll();
    res.json({ counselors: counselors.map(toCamel) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch counselors' });
  }
};

const getCounselor = async (req, res) => {
  try {
    const counselor = await Counselor.findById(req.params.id);
    if (!counselor) return res.status(404).json({ message: 'Counselor not found' });
    res.json({ counselor: toCamel(counselor) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch counselor' });
  }
};

const getApplications = async (req, res) => {
  try {
    const result = await Application.findAll(req.query);
    res.json({ applications: result.applications.map(toCamel), pagination: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch applications' });
  }
};

const createApplication = async (req, res) => {
  try {
    const application = await Application.create(req.body, req.user.id);
    res.status(201).json({ message: 'Application created', application: toCamel(application) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create application' });
  }
};

const updateApplication = async (req, res) => {
  try {
    const application = await Application.update(req.params.id, req.body, req.user.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });
    res.json({ message: 'Application updated', application: toCamel(application) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update application' });
  }
};

const getAdmissions = async (req, res) => {
  try {
    const result = await Admission.findAll(req.query);
    res.json({ admissions: result.admissions.map(toCamel), pagination: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch admissions' });
  }
};

const getReports = async (req, res) => {
  try {
    const reports = await Admission.getReports(req.query);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
};

module.exports = {
  getFollowups, createFollowup, updateFollowup,
  getTasks, createTask, updateTask,
  getCounselors, getCounselor,
  getApplications, createApplication, updateApplication,
  getAdmissions, getReports,
};
