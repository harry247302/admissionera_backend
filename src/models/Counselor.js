const { query } = require('../config/db');

const Counselor = {
  async findAll() {
    const { rows } = await query(
      `SELECT c.*, u.name, u.email,
        (SELECT COUNT(*) FROM leads l WHERE l.assigned_counselor_id = c.id) AS total_leads,
        (SELECT COUNT(*) FROM leads l WHERE l.assigned_counselor_id = c.id AND l.status NOT IN ('ADMISSION_CONFIRMED','LOST','NOT_INTERESTED')) AS active_leads,
        (SELECT COUNT(*) FROM leads l WHERE l.assigned_counselor_id = c.id AND l.status = 'ADMISSION_CONFIRMED') AS converted_leads,
        (SELECT COUNT(*) FROM followups f WHERE f.counselor_id = c.id AND f.followup_date = CURRENT_DATE AND f.status = 'PENDING') AS followups_today
       FROM counselors c
       JOIN users u ON u.id = c.user_id
       WHERE c.is_active = true
       ORDER BY u.name`
    );

    return rows.map((r) => ({
      ...r,
      conversion_rate: r.total_leads > 0
        ? ((r.converted_leads / r.total_leads) * 100).toFixed(1)
        : '0.0',
    }));
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT c.*, u.name, u.email FROM counselors c
       JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
      [id]
    );
    if (!rows[0]) return null;

    const stats = await query(
      `SELECT
        COUNT(*) AS total_leads,
        COUNT(*) FILTER (WHERE status = 'CONTACTED') AS contacted,
        COUNT(*) FILTER (WHERE status = 'INTERESTED') AS interested,
        COUNT(*) FILTER (WHERE status IN ('APPLICATION_STARTED','APPLICATION_SUBMITTED')) AS applications,
        COUNT(*) FILTER (WHERE status = 'ADMISSION_CONFIRMED') AS admissions
       FROM leads WHERE assigned_counselor_id = $1`,
      [id]
    );

    const revenue = await query(
      `SELECT COALESCE(SUM(revenue), 0) AS total FROM admissions WHERE counselor_id = $1`,
      [id]
    );

    const pendingFollowups = await query(
      `SELECT COUNT(*) AS count FROM followups WHERE counselor_id = $1 AND status = 'PENDING'`,
      [id]
    );

    const s = stats.rows[0];
    return {
      ...rows[0],
      stats: {
        ...s,
        conversion_rate: s.total_leads > 0
          ? ((parseInt(s.admissions, 10) / parseInt(s.total_leads, 10)) * 100).toFixed(1)
          : '0.0',
        revenue: revenue.rows[0].total,
        pending_followups: pendingFollowups.rows[0].count,
      },
    };
  },
};

module.exports = Counselor;
