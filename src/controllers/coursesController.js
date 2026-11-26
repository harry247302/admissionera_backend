const { pool } = require("../config/db");

const fetchCoursesByUniversity = async (req, res) => {
  const { university_id } = req.params;

  try {
    const result = await pool.query(
        `SELECT

        
          
          
       
           c.name,
           c.degree,
           c.level,
           c.code,
           c.slug,
           c.study_mode
         FROM course_fees fs
         JOIN courses c
           ON c.uuid = fs.course_id
          AND c.is_deleted = false
         WHERE fs.university_id = $1
         ORDER BY fs.id`,
        [university_id]
      );
    res.json(result.rows);
  } catch (err) {
    console.error("fetchCoursesByUniversity error:", err);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
};

module.exports = {
  fetchCoursesByUniversity,
};