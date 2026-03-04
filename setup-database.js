require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database...');
    
    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        location TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        cutoff_time TIMESTAMP NOT NULL
      )
    `);
    console.log('✅ Sessions table created');

    // Create slots table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS slots (
        id SERIAL PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id),
        time TEXT NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 10,
        booked INTEGER NOT NULL DEFAULT 0
      )
    `);
    console.log('✅ Slots table created');

    // Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        session_id TEXT REFERENCES sessions(id),
        slot_time TEXT NOT NULL,
        items JSONB NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL,
        stripe_payment_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Orders table created');

    // Insert test sessions
    await pool.query(`
      INSERT INTO sessions (id, date, time, location, start_time, cutoff_time)
      VALUES 
        ('tue-lunch-1', 'Tuesday, 11th March', '12:00 PM - 1:30 PM', 'Victoria Square, Belfast', '2026-03-11 12:00:00', '2026-03-11 10:00:00'),
        ('thu-lunch-1', 'Thursday, 13th March', '12:00 PM - 1:30 PM', 'CastleCourt, Belfast', '2026-03-13 12:00:00', '2026-03-13 10:00:00'),
        ('fri-eve-1', 'Friday, 14th March', '6:00 PM - 7:30 PM', 'Titanic Quarter, Belfast', '2026-03-14 18:00:00', '2026-03-14 17:00:00')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Test sessions inserted');

    // Insert slots
    const lunchSlots = ['12:00', '12:15', '12:30', '12:45', '13:00', '13:15'];
    const eveningSlots = ['18:00', '18:15', '18:30', '18:45', '19:00', '19:15'];

    await pool.query(`
      INSERT INTO slots (session_id, time) VALUES
        ('tue-lunch-1', '12:00'),
        ('tue-lunch-1', '12:15'),
        ('tue-lunch-1', '12:30'),
        ('tue-lunch-1', '12:45'),
        ('tue-lunch-1', '13:00'),
        ('tue-lunch-1', '13:15'),
        ('thu-lunch-1', '12:00'),
        ('thu-lunch-1', '12:15'),
        ('thu-lunch-1', '12:30'),
        ('thu-lunch-1', '12:45'),
        ('thu-lunch-1', '13:00'),
        ('thu-lunch-1', '13:15'),
        ('fri-eve-1', '18:00'),
        ('fri-eve-1', '18:15'),
        ('fri-eve-1', '18:30'),
        ('fri-eve-1', '18:45'),
        ('fri-eve-1', '19:00'),
        ('fri-eve-1', '19:15')
    `);
    console.log('✅ Slots inserted');

    console.log('\n🎉 Database setup complete!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

setupDatabase();