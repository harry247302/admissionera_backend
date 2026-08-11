const { query } = require('../config/db');

const generateCode = (prefix, id) => `${prefix}${String(id).padStart(5, '0')}`;

const logActivity = async (client, { leadId, activityType, description, metadata, performedBy }) => {
  await client.query(
    `INSERT INTO lead_activities (lead_id, activity_type, description, metadata, performed_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [leadId, activityType, description, JSON.stringify(metadata || {}), performedBy]
  );
};

const Lead = {
  async findAll(filters = {}) {
    const {
      search, status, priority, leadSource, counselorId, course, university, city,
      createdFrom, createdTo, followupFrom, followupTo,
      page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC',
    } = filters;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(
        l.full_name ILIKE $${paramIndex} OR l.phone ILIKE $${paramIndex}
        OR l.email ILIKE $${paramIndex} OR l.lead_code ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (status) { conditions.push(`l.status = $${paramIndex++}`); params.push(status); }
    if (priority) { conditions.push(`l.priority = $${paramIndex++}`); params.push(priority); }
    if (leadSource) { conditions.push(`l.lead_source = $${paramIndex++}`); params.push(leadSource); }
    if (counselorId) { conditions.push(`l.assigned_counselor_id = $${paramIndex++}`); params.push(counselorId); }
    if (course) { conditions.push(`l.course ILIKE $${paramIndex++}`); params.push(`%${course}%`); }
    if (university) { conditions.push(`l.university ILIKE $${paramIndex++}`); params.push(`%${university}%`); }
    if (city) { conditions.push(`l.city ILIKE $${paramIndex++}`); params.push(`%${city}%`); }
    if (createdFrom) { conditions.push(`l.created_at >= $${paramIndex++}`); params.push(createdFrom); }
    if (createdTo) { conditions.push(`l.created_at <= $${paramIndex++}`); params.push(createdTo); }
    if (followupFrom) { conditions.push(`l.next_followup_at >= $${paramIndex++}`); params.push(followupFrom); }
    if (followupTo) { conditions.push(`l.next_followup_at <= $${paramIndex++}`); params.push(followupTo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSort = ['created_at', 'full_name', 'status', 'priority', 'next_followup_at'];
    const sort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) FROM leads l ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT l.*, u.name AS counselor_name
       FROM leads l
       LEFT JOIN counselors c ON c.id = l.assigned_counselor_id
       LEFT JOIN users u ON u.id = c.user_id
       ${where}
       ORDER BY l.${sort} ${order}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return { leads: rows, total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT l.*, u.name AS counselor_name, u.email AS counselor_email
       FROM leads l
       LEFT JOIN counselors c ON c.id = l.assigned_counselor_id
       LEFT JOIN users u ON u.id = c.user_id
       WHERE l.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create(data, userId) {
    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      const tempCode = `LD${Date.now()}`;
      const { rows } = await client.query(
        `INSERT INTO leads (
          lead_code, full_name, phone, email, whatsapp_number, date_of_birth, gender,
          city, state, course, university, specialization, academic_qualification,
          passing_year, percentage_cgpa, preferred_location, budget, lead_source,
          lead_campaign, assigned_counselor_id, status, priority, notes, created_by, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$24
        ) RETURNING *`,
        [
          tempCode, data.fullName, data.phone, data.email, data.whatsappNumber,
          data.dateOfBirth || null, data.gender, data.city, data.state, data.course,
          data.university, data.specialization, data.academicQualification,
          data.passingYear || null, data.percentageCgpa, data.preferredLocation,
          data.budget || null, data.leadSource || 'OTHER', data.leadCampaign,
          data.assignedCounselorId || null, data.status || 'NEW', data.priority || 'MEDIUM',
          data.notes, userId,
        ]
      );

      const lead = rows[0];
      const leadCode = generateCode('LD', lead.id);
      const { rows: updated } = await client.query(
        'UPDATE leads SET lead_code = $1 WHERE id = $2 RETURNING *',
        [leadCode, lead.id]
      );

      await logActivity(client, {
        leadId: lead.id,
        activityType: 'LEAD_CREATED',
        description: `Lead created for ${data.fullName}`,
        performedBy: userId,
      });

      await client.query('COMMIT');
      return updated[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id, data, userId) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      const fields = [];
      const values = [];
      let i = 1;
      const map = {
        fullName: 'full_name', phone: 'phone', email: 'email', whatsappNumber: 'whatsapp_number',
        dateOfBirth: 'date_of_birth', gender: 'gender', city: 'city', state: 'state',
        course: 'course', university: 'university', specialization: 'specialization',
        academicQualification: 'academic_qualification', passingYear: 'passing_year',
        percentageCgpa: 'percentage_cgpa', preferredLocation: 'preferred_location',
        budget: 'budget', leadSource: 'lead_source', leadCampaign: 'lead_campaign',
        assignedCounselorId: 'assigned_counselor_id', status: 'status', priority: 'priority',
        notes: 'notes', lastContactAt: 'last_contact_at', nextFollowupAt: 'next_followup_at',
      };

      for (const [key, col] of Object.entries(map)) {
        if (data[key] !== undefined) {
          fields.push(`${col} = $${i++}`);
          values.push(data[key]);
        }
      }

      fields.push(`updated_by = $${i++}`);
      values.push(userId);
      fields.push('updated_at = NOW()');
      values.push(id);

      const { rows } = await client.query(
        `UPDATE leads SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );

      if (data.status && data.status !== existing.status) {
        await logActivity(client, {
          leadId: id,
          activityType: 'STATUS_CHANGED',
          description: `Status changed from ${existing.status} to ${data.status}`,
          metadata: { from: existing.status, to: data.status },
          performedBy: userId,
        });
      }

      if (data.assignedCounselorId !== undefined && data.assignedCounselorId !== existing.assigned_counselor_id) {
        await logActivity(client, {
          leadId: id,
          activityType: 'COUNSELOR_ASSIGNED',
          description: 'Counselor assignment updated',
          metadata: { counselorId: data.assignedCounselorId },
          performedBy: userId,
        });
      }

      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async delete(id) {
    const { rowCount } = await query('DELETE FROM leads WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async bulkUpdate(ids, data, userId) {
    const results = [];
    for (const id of ids) {
      const updated = await this.update(id, data, userId);
      if (updated) results.push(updated);
    }
    return results;
  },

  async getActivities(leadId) {
    const { rows } = await query(
      `SELECT a.*, u.name AS performed_by_name
       FROM lead_activities a
       LEFT JOIN users u ON u.id = a.performed_by
       WHERE a.lead_id = $1
       ORDER BY a.created_at DESC`,
      [leadId]
    );
    return rows;
  },

  async getNotes(leadId) {
    const { rows } = await query(
      `SELECT n.*, u.name AS created_by_name
       FROM lead_notes n
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.lead_id = $1
       ORDER BY n.created_at DESC`,
      [leadId]
    );
    return rows;
  },

  async addNote(leadId, note, userId) {
    const { rows } = await query(
      `INSERT INTO lead_notes (lead_id, note, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [leadId, note, userId]
    );
    await query(
      `INSERT INTO lead_activities (lead_id, activity_type, description, performed_by)
       VALUES ($1, 'NOTE_ADDED', $2, $3)`,
      [leadId, 'Note added', userId]
    );
    return rows[0];
  },

  async getDashboardStats() {
    const { rows } = await query(`
      SELECT
        COUNT(*) AS total_leads,
        COUNT(*) FILTER (WHERE status = 'NEW') AS new_leads,
        COUNT(*) FILTER (WHERE status = 'CONTACTED') AS contacted,
        COUNT(*) FILTER (WHERE status = 'INTERESTED') AS interested,
        COUNT(*) FILTER (WHERE status = 'FOLLOW_UP') AS follow_up,
        COUNT(*) FILTER (WHERE status IN ('APPLICATION_STARTED','APPLICATION_SUBMITTED')) AS applications,
        COUNT(*) FILTER (WHERE status = 'ADMISSION_CONFIRMED') AS admissions,
        COUNT(*) FILTER (WHERE status IN ('NOT_INTERESTED','LOST')) AS lost_leads
      FROM leads
    `);

    const stats = rows[0];
    const total = parseInt(stats.total_leads, 10) || 0;
    const admissions = parseInt(stats.admissions, 10) || 0;
    stats.conversion_rate = total > 0 ? ((admissions / total) * 100).toFixed(1) : '0.0';

    const sourceResult = await query(`
      SELECT lead_source, COUNT(*) AS count FROM leads GROUP BY lead_source ORDER BY count DESC
    `);

    const funnelResult = await query(`
      SELECT status, COUNT(*) AS count FROM leads
      WHERE status NOT IN ('NOT_INTERESTED','LOST')
      GROUP BY status
    `);

    const dailyResult = await query(`
      SELECT DATE(created_at) AS date, COUNT(*) AS count
      FROM leads WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY date
    `);

    const counselorResult = await query(`
      SELECT u.name, COUNT(l.id) AS count
      FROM leads l
      JOIN counselors c ON c.id = l.assigned_counselor_id
      JOIN users u ON u.id = c.user_id
      GROUP BY u.name ORDER BY count DESC LIMIT 10
    `);

    const revenueResult = await query(`
      SELECT COALESCE(SUM(revenue), 0) AS total_revenue FROM admissions
    `);

    return {
      stats,
      sources: sourceResult.rows,
      funnel: funnelResult.rows,
      dailyLeads: dailyResult.rows,
      counselorPerformance: counselorResult.rows,
      totalRevenue: revenueResult.rows[0].total_revenue,
    };
  },
};

module.exports = Lead;
