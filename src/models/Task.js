const { query } = require('../config/db');

const Task = {
  async findAll(filters = {}) {
    const { status, assignedTo, page = 1, limit = 20 } = filters;
    const conditions = [];
    const params = [];
    let i = 1;

    if (status) { conditions.push(`t.status = $${i++}`); params.push(status); }
    if (assignedTo) { conditions.push(`t.assigned_to = $${i++}`); params.push(assignedTo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) FROM crm_tasks t ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT t.*, l.full_name AS lead_name, l.lead_code, u.name AS assigned_to_name
       FROM crm_tasks t
       LEFT JOIN leads l ON l.id = t.lead_id
       LEFT JOIN users u ON u.id = t.assigned_to
       ${where}
       ORDER BY t.due_date ASC NULLS LAST
       LIMIT $${i++} OFFSET $${i}`,
      params
    );

    return { tasks: rows, total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
  },

  async create(data, userId) {
    const { rows } = await query(
      `INSERT INTO crm_tasks (title, lead_id, assigned_to, due_date, priority, status, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.title, data.leadId, data.assignedTo, data.dueDate, data.priority || 'MEDIUM',
        data.status || 'PENDING', data.description, userId]
    );
    return rows[0];
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const map = {
      title: 'title', leadId: 'lead_id', assignedTo: 'assigned_to', dueDate: 'due_date',
      priority: 'priority', status: 'status', description: 'description',
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) { fields.push(`${col} = $${i++}`); values.push(data[key]); }
    }
    fields.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await query(
      `UPDATE crm_tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return rows[0] || null;
  },
};

module.exports = Task;
