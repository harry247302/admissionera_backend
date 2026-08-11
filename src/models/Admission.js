const { query } = require('../config/db');
const Application = require('./Application');

const generateCode = (prefix, id) => `${prefix}${String(id).padStart(5, '0')}`;

const Admission = {
  async findAll(filters = {}) {
    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) FROM admissions');
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await query(
      `SELECT ad.*, l.full_name AS lead_name, l.lead_code, u.name AS counselor_name
       FROM admissions ad
       JOIN leads l ON l.id = ad.lead_id
       LEFT JOIN counselors c ON c.id = ad.counselor_id
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY ad.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return { admissions: rows, total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
  },

  async convertLead(leadId, data, userId) {
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      const leadResult = await client.query('SELECT * FROM leads WHERE id = $1', [leadId]);
      const lead = leadResult.rows[0];
      if (!lead) { await client.query('ROLLBACK'); return null; }

      let applicationId = data.applicationId;
      if (!applicationId) {
        const app = await Application.create({
          leadId,
          university: data.university || lead.university,
          course: data.course || lead.course,
          specialization: data.specialization || lead.specialization,
          assignedCounselorId: lead.assigned_counselor_id,
          status: 'SUBMITTED',
        }, userId);
        applicationId = app.id;
      }

      const tempCode = `AD${Date.now()}`;
      const { rows } = await client.query(
        `INSERT INTO admissions (admission_code, lead_id, application_id, university, course, admission_date, revenue, counselor_id, admission_source, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [tempCode, leadId, applicationId, data.university || lead.university,
          data.course || lead.course, data.admissionDate || new Date().toISOString().split('T')[0],
          data.revenue || 0, lead.assigned_counselor_id, data.admissionSource || lead.lead_source, userId]
      );

      const admissionCode = generateCode('AD', rows[0].id);
      const { rows: updated } = await client.query(
        'UPDATE admissions SET admission_code = $1 WHERE id = $2 RETURNING *',
        [admissionCode, rows[0].id]
      );

      await client.query(
        `UPDATE leads SET status = 'ADMISSION_CONFIRMED', updated_by = $1, updated_at = NOW() WHERE id = $2`,
        [userId, leadId]
      );

      await client.query(
        `INSERT INTO lead_activities (lead_id, activity_type, description, metadata, performed_by)
         VALUES ($1, 'ADMISSION_CONFIRMED', $2, $3, $4)`,
        [leadId, `Lead converted to admission ${admissionCode}`, JSON.stringify({ admissionId: rows[0].id }), userId]
      );

      await client.query('COMMIT');
      return updated[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getReports(filters = {}) {
    const { period = '30' } = filters;
    const interval = period === '7' ? '7 days' : period === 'today' ? '1 day' : '30 days';

    const sourceReport = await query(
      `SELECT lead_source, COUNT(*) AS count FROM leads
       WHERE created_at >= NOW() - INTERVAL '${interval}'
       GROUP BY lead_source ORDER BY count DESC`
    );

    const conversionReport = await query(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'ADMISSION_CONFIRMED') AS converted
       FROM leads WHERE created_at >= NOW() - INTERVAL '${interval}'`
    );

    const counselorReport = await query(
      `SELECT u.name,
        COUNT(l.id) AS leads,
        COUNT(l.id) FILTER (WHERE l.status = 'ADMISSION_CONFIRMED') AS admissions
       FROM counselors c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN leads l ON l.assigned_counselor_id = c.id AND l.created_at >= NOW() - INTERVAL '${interval}'
       GROUP BY u.name ORDER BY leads DESC`
    );

    const revenueReport = await query(
      `SELECT COALESCE(SUM(revenue), 0) AS total FROM admissions
       WHERE created_at >= NOW() - INTERVAL '${interval}'`
    );

    const followupReport = await query(
      `SELECT status, COUNT(*) AS count FROM followups
       WHERE created_at >= NOW() - INTERVAL '${interval}'
       GROUP BY status`
    );

    return {
      sourceReport: sourceReport.rows,
      conversionReport: conversionReport.rows[0],
      counselorReport: counselorReport.rows,
      revenueReport: revenueReport.rows[0],
      followupReport: followupReport.rows,
    };
  },
};

module.exports = Admission;
