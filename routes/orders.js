const express = require('express');
const router = express.Router();
const pool = global.pool;

// Create new order
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      name, 
      phone, 
      sessionId, 
      slotTime, 
      items, 
      total 
    } = req.body;
    
    await client.query('BEGIN');
    
    // Check slot availability
    const slotCheck = await client.query(
      'SELECT capacity, booked FROM slots WHERE session_id = $1 AND time = $2',
      [sessionId, slotTime]
    );
    
    if (slotCheck.rows.length === 0) {
      throw new Error('Slot not found');
    }
    
    const slot = slotCheck.rows[0];
    const available = slot.capacity - slot.booked;
    
    if (items.length > available) {
      throw new Error(`Only ${available} burgers available in this slot`);
    }
    
    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders 
       (name, phone, session_id, slot_time, items, total, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
       RETURNING *`,
      [name, phone, sessionId, slotTime, JSON.stringify(items), total, 'confirmed']
    );
    
    // Update slot capacity
    await client.query(
      'UPDATE slots SET booked = booked + $1 WHERE session_id = $2 AND time = $3',
      [items.length, sessionId, slotTime]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json(orderResult.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get orders by phone number
router.get('/user/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const result = await pool.query(
      `SELECT o.*, s.date, s.time as session_time, s.location, s.start_time
       FROM orders o
       JOIN sessions s ON o.session_id = s.id
       WHERE o.phone = $1
       ORDER BY o.created_at DESC`,
      [phone]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get all orders for a session (operator dashboard)
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM orders 
       WHERE session_id = $1 
       ORDER BY slot_time, created_at`,
      [sessionId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching session orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Cancel order
router.delete('/:orderId', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { orderId } = req.params;
    
    await client.query('BEGIN');
    
    // Get order details
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }
    
    const order = orderResult.rows[0];
    const items = JSON.parse(order.items);
    
    // Check if can still cancel (>4 hours before session)
    const sessionResult = await client.query(
      'SELECT start_time FROM sessions WHERE id = $1',
      [order.session_id]
    );
    
    const hoursUntil = (new Date(sessionResult.rows[0].start_time) - new Date()) / (1000 * 60 * 60);
    
    if (hoursUntil <= 4) {
      throw new Error('Cannot cancel - less than 4 hours before session');
    }
    
    // Delete order
    await client.query('DELETE FROM orders WHERE id = $1', [orderId]);
    
    // Restore slot capacity
    await client.query(
      'UPDATE slots SET booked = booked - $1 WHERE session_id = $2 AND time = $3',
      [items.length, order.session_id, order.slot_time]
    );
    
    await client.query('COMMIT');
    
    res.json({ message: 'Order cancelled successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling order:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;