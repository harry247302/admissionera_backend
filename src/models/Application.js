const { query } = require('../config/db');

const generateCode = (prefix, id) => `${prefix}${String(id).padStart(5, '0')}`;

const Application = {
  async findAll(filters = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const conditions = [];
    const params = [];
    let i = 1;

    if (status) { conditions.push(`a.status = $${i++}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) FROM applications a ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT a.*, l.full_name AS lead_name, l.lead_code, u.name AS counselor_name
       FROM applications a
       JOIN leads l ON l.id = a.lead_id
       LEFT JOIN counselors c ON c.id = a.assigned_counselor_id
       LEFT JOIN users u ON u.id = c.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      params
    );

    return { applications: rows, total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
  },

  async create(data, userId) {
    const tempCode = `AP${Date.now()}`;
    const { rows } = await query(
      `INSERT INTO applications (application_code, lead_id, university, course, specialization, status, application_date, documents_status, payment_status, assigned_counselor_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [tempCode, data.leadId, data.university, data.course, data.specialization,
        data.status || 'DRAFT', data.applicationDate || new Date().toISOString().split('T')[0],
        data.documentsStatus || 'PENDING', data.paymentStatus || 'PENDING',
        data.assignedCounselorId, userId]
    );

    const appCode = generateCode('AP', rows[0].id);
    const { rows: updated } = await query(
      'UPDATE applications SET application_code = $1 WHERE id = $2 RETURNING *',
      [appCode, rows[0].id]
    );

    await query(
      `UPDATE leads SET status = 'APPLICATION_STARTED' WHERE id = $1 AND status NOT IN ('APPLICATION_SUBMITTED','ADMISSION_CONFIRMED')`,
      [data.leadId]
    );

    await query(
      `INSERT INTO lead_activities (lead_id, activity_type, description, performed_by)
       VALUES ($1, 'APPLICATION_STARTED', $2, $3)`,
      [data.leadId, `Application ${appCode} started`, userId]
    );

    return updated[0];
  },

  async update(id, data, userId) {
    const fields = [];
    const values = [];
    let i = 1;
    const map = {
      university: 'university', course: 'course', specialization: 'specialization',
      status: 'status', applicationDate: 'application_date', documentsStatus: 'documents_status',
      paymentStatus: 'payment_status', assignedCounselorId: 'assigned_counselor_id',
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) { fields.push(`${col} = $${i++}`); values.push(data[key]); }
    }
    fields.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await query(
      `UPDATE applications SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    if (data.status === 'SUBMITTED' && rows[0]) {
      await query(`UPDATE leads SET status = 'APPLICATION_SUBMITTED' WHERE id = $1`, [rows[0].lead_id]);
      await query(
        `INSERT INTO lead_activities (lead_id, activity_type, description, performed_by)
         VALUES ($1, 'APPLICATION_SUBMITTED', $2, $3)`,
        [rows[0].lead_id, `Application submitted`, userId]
      );
    }

    return rows[0] || null;
  },
};

module.exports = Application;
