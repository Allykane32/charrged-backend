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
// Create new session
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id, date, time, location, startTime, cutoffTime, slots } = req.body;
    
    await client.query('BEGIN');
    
    // Insert session
    await client.query(
      `INSERT INTO sessions (id, date, time, location, start_time, cutoff_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, date, time, location, startTime, cutoffTime]
    );
    
    // Insert slots
    for (const slot of slots) {
      await client.query(
        `INSERT INTO slots (session_id, time, capacity, booked)
         VALUES ($1, $2, $3, 0)`,
        [id, slot.time, slot.capacity]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: 'Session created successfully', id });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  } finally {
    client.release();
  }
});

// Update session
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { date, time, location, startTime, cutoffTime } = req.body;
    
    await client.query('BEGIN');
    
    await client.query(
      `UPDATE sessions 
       SET date = $1, time = $2, location = $3, start_time = $4, cutoff_time = $5
       WHERE id = $6`,
      [date, time, location, startTime, cutoffTime, id]
    );
    
    await client.query('COMMIT');
    res.json({ message: 'Session updated successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  } finally {
    client.release();
  }
});

// Delete session
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Check if session has orders
    const ordersCheck = await client.query(
      'SELECT COUNT(*) FROM orders WHERE session_id = $1',
      [id]
    );
    
    if (parseInt(ordersCheck.rows[0].count) > 0) {
      throw new Error('Cannot delete session with existing orders');
    }
    
    // Delete slots first (foreign key constraint)
    await client.query('DELETE FROM slots WHERE session_id = $1', [id]);
    
    // Delete session
    await client.query('DELETE FROM sessions WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    res.json({ message: 'Session deleted successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting session:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});
module.exports = router;