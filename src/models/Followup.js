const { query } = require('../config/db');

const Followup = {
  async findAll(filters = {}) {
    const { status, counselorId, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const conditions = [];
    const params = [];
    let i = 1;

    if (status) { conditions.push(`f.status = $${i++}`); params.push(status); }
    if (counselorId) { conditions.push(`f.counselor_id = $${i++}`); params.push(counselorId); }
    if (dateFrom) { conditions.push(`f.followup_date >= $${i++}`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`f.followup_date <= $${i++}`); params.push(dateTo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) FROM followups f ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT f.*, l.full_name AS lead_name, l.lead_code, u.name AS counselor_name
       FROM followups f
       JOIN leads l ON l.id = f.lead_id
       LEFT JOIN counselors c ON c.id = f.counselor_id
       LEFT JOIN users u ON u.id = c.user_id
       ${where}
       ORDER BY f.followup_date ASC, f.followup_time ASC
       LIMIT $${i++} OFFSET $${i}`,
      params
    );

    return { followups: rows, total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
  },

  async create(data, userId) {
    const { rows } = await query(
      `INSERT INTO followups (lead_id, counselor_id, followup_date, followup_time, followup_type, priority, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.leadId, data.counselorId, data.followupDate, data.followupTime, data.followupType || 'CALL',
        data.priority || 'MEDIUM', data.notes, data.status || 'PENDING', userId]
    );

    await query(
      `UPDATE leads SET next_followup_at = $1 WHERE id = $2`,
      [`${data.followupDate}T${data.followupTime || '00:00:00'}`, data.leadId]
    );

    await query(
      `INSERT INTO lead_activities (lead_id, activity_type, description, performed_by)
       VALUES ($1, 'FOLLOWUP_SCHEDULED', $2, $3)`,
      [data.leadId, `Follow-up scheduled for ${data.followupDate}`, userId]
    );

    return rows[0];
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const map = {
      followupDate: 'followup_date', followupTime: 'followup_time', followupType: 'followup_type',
      priority: 'priority', notes: 'notes', status: 'status', counselorId: 'counselor_id',
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) { fields.push(`${col} = $${i++}`); values.push(data[key]); }
    }
    fields.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await query(
      `UPDATE followups SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return rows[0] || null;
  },
};

module.exports = Followup;
