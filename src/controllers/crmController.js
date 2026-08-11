const Lead = require('../models/Lead');
const Admission = require('../models/Admission');

const toCamel = (obj) => {
  if (!obj) return obj;
  const map = {
    lead_code: 'leadCode', full_name: 'fullName', whatsapp_number: 'whatsappNumber',
    date_of_birth: 'dateOfBirth', academic_qualification: 'academicQualification',
    passing_year: 'passingYear', percentage_cgpa: 'percentageCgpa',
    preferred_location: 'preferredLocation', lead_source: 'leadSource',
    lead_campaign: 'leadCampaign', assigned_counselor_id: 'assignedCounselorId',
    counselor_name: 'counselorName', counselor_email: 'counselorEmail',
    last_contact_at: 'lastContactAt', next_followup_at: 'nextFollowupAt',
    created_by: 'createdBy', updated_by: 'updatedBy',
    created_at: 'createdAt', updated_at: 'updatedAt',
    activity_type: 'activityType', performed_by: 'performedBy',
    performed_by_name: 'performedByName', created_by_name: 'createdByName',
  };
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[map[k] || k] = v;
  }
  return result;
};

const getLeads = async (req, res) => {
  try {
    const result = await Lead.findAll(req.query);
    res.json({
      leads: result.leads.map(toCamel),
      pagination: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    console.error('getLeads:', err);
    res.status(500).json({ message: 'Failed to fetch leads' });
  }
};

const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ lead: toCamel(lead) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch lead' });
  }
};

const createLead = async (req, res) => {
  try {
    const lead = await Lead.create(req.body, req.user.id);
    res.status(201).json({ message: 'Lead created successfully', lead: toCamel(lead) });
  } catch (err) {
    console.error('createLead:', err);
    res.status(500).json({ message: 'Failed to create lead' });
  }
};

const updateLead = async (req, res) => {
  try {
    const lead = await Lead.update(req.params.id, req.body, req.user.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead updated successfully', lead: toCamel(lead) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update lead' });
  }
};

const deleteLead = async (req, res) => {
  try {
    const deleted = await Lead.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete lead' });
  }
};

const bulkUpdateLeads = async (req, res) => {
  try {
    const { ids, data } = req.body;
    if (!ids?.length) return res.status(400).json({ message: 'No leads selected' });
    const leads = await Lead.bulkUpdate(ids, data, req.user.id);
    res.json({ message: 'Leads updated successfully', leads: leads.map(toCamel) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to bulk update leads' });
  }
};

const getActivities = async (req, res) => {
  try {
    const activities = await Lead.getActivities(req.params.id);
    res.json({ activities: activities.map(toCamel) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
};

const getNotes = async (req, res) => {
  try {
    const notes = await Lead.getNotes(req.params.id);
    res.json({ notes: notes.map(toCamel) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notes' });
  }
};

const addNote = async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ message: 'Note is required' });
    const result = await Lead.addNote(req.params.id, note, req.user.id);
    res.status(201).json({ message: 'Note added successfully', note: toCamel(result) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add note' });
  }
};

const convertLead = async (req, res) => {
  try {
    const admission = await Admission.convertLead(req.params.id, req.body, req.user.id);
    if (!admission) return res.status(404).json({ message: 'Lead not found' });
    res.status(201).json({ message: 'Lead converted successfully', admission });
  } catch (err) {
    console.error('convertLead:', err);
    res.status(500).json({ message: 'Failed to convert lead' });
  }
};

const getDashboard = async (_req, res) => {
  try {
    const dashboard = await Lead.getDashboardStats();
    res.json({ dashboard });
  } catch (err) {
    console.error('getDashboard:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard' });
  }
};

module.exports = {
  getLeads, getLead, createLead, updateLead, deleteLead,
  bulkUpdateLeads, getActivities, getNotes, addNote, convertLead, getDashboard,
};
