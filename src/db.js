const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'movie_booking',
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

module.exports = pool;