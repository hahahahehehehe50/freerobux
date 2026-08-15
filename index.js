import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create table if it doesn't exist
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS codes (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        code VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// API endpoint to claim codes
app.post('/api/codes/claim', async (req, res) => {
  try {
    const { username, code } = req.body;

    if (!username || !code) {
      return res.status(400).json({ error: 'Username and code required' });
    }

    // Check if code already exists
    const existingCode = await pool.query(
      'SELECT * FROM codes WHERE code = $1',
      [code]
    );

    if (existingCode.rows.length > 0) {
      return res.status(409).json({ error: 'Code already claimed' });
    }

    // Insert new code
    const result = await pool.query(
      'INSERT INTO codes (username, code) VALUES ($1, $2) RETURNING *',
      [username, code]
    );

    res.json({ ok: true, code: result.rows[0] });
  } catch (error) {
    console.error('Code claim error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get codes by username (optional - for testing)
app.get('/api/codes/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const result = await pool.query(
      'SELECT * FROM codes WHERE username = $1 ORDER BY created_at DESC',
      [username]
    );
    res.json({ codes: result.rows });
  } catch (error) {
    console.error('Get codes error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Robux codes service listening on port ${PORT}`);
  await initDatabase();
});