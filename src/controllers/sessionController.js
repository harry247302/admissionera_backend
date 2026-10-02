const { pool } = require("../config/db")

const createSession = async (req,res)=>{
    try {
        const { name, status } = req.body
        if(!name){
            return res.status(400).json({
                success: false,
                message: 'Session name is required'
            })
        }
        const isActive = status !== false && status !== 'false' && status !== 'INACTIVE' && status !== 'inactive'
        const session = await pool.query(
            'INSERT INTO session (name, status) VALUES ($1, $2) RETURNING *',
            [name, isActive]
        )
        if(session.rowCount === 0){
            return res.status(400).json({
                success: false,
                message: 'Failed to create session'
            })
        }
        return res.status(201).json({
            success: true,
            message: 'Session created successfully',
            data: session.rows[0],
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const getSessions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, start_date, expiry_date, created_at, status
       FROM session
       ORDER BY start_date DESC NULLS LAST, created_at DESC NULLS LAST`
    );

    return res.status(200).json({
      success: true,
      sessions: result.rows,
      data: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch sessions',
    });
  }
};

const sessionStatus = async (req,res)=>{
    try {
        const {id} = req.params;
        if(!id){
            res.status(400).json({
                success: false,
                message: 'Session ID is required'
            })
        }
        const sessionDeactivate =  await pool.query(
            'UPDATE session SET status = $1 WHERE id = $2',
            [status,id]
        )   
        
        return res.status(200).json({
            success: true,
            message: 'Status updated successfully'
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })   }
}
module.exports = {
    createSession,
    getSessions,
}