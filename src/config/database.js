require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '69.62.99.122',
  port: process.env.DB_PORT || 1515,
  user: process.env.DB_USER || 'rjbd',
  password: process.env.DB_PASSWORD || 'rjbd',
  database: process.env.DB_NAME || 'rjbd',
  ssl: false 
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
