const express = require('express');
const router = express.Router();
const pool = global.pool;

// Get all sessions with slot availability
router.get('/', async (req, res) => {
  try {
    const sessionsQuery = `
      SELECT 
        s.id,
        s.date,
        s.time,
        s.location,
        s.start_time,
        s.cutoff_time,
        json_agg(
          json_build_object(
            'time', sl.time,
            'capacity', sl.capacity,
            'booked', sl.booked
          ) ORDER BY sl.time
        ) as slots
      FROM sessions s
      LEFT JOIN slots sl ON s.id = sl.session_id
      WHERE s.start_time > NOW()
      GROUP BY s.id, s.date, s.time, s.location, s.start_time, s.cutoff_time
      ORDER BY s.start_time ASC
    `;
    
    const result = await pool.query(sessionsQuery);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get specific session
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sessionQuery = `
      SELECT 
        s.*,
        json_agg(
          json_build_object(
            'time', sl.time,
            'capacity', sl.capacity,
            'booked', sl.booked
          ) ORDER BY sl.time
        ) as slots
      FROM sessions s
      LEFT JOIN slots sl ON s.id = sl.session_id
      WHERE s.id = $1
      GROUP BY s.id
    `;
    
    const result = await pool.query(sessionQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

module.exports = router;