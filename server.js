require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Make pool available globally
global.pool = pool;

// Middleware
app.use(cors());
app.use(express.json());

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Charrged API is running' });
});

// Import route files
const sessionsRoutes = require('./routes/sessions');
const ordersRoutes = require('./routes/orders');

app.use('/api/sessions', sessionsRoutes);
app.use('/api/orders', ordersRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🔥 Charrged API running on http://localhost:${PORT}`);
});