const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'csce-315-db.engr.tamu.edu',
  user: process.env.DB_USER || 'team_42',
  database: process.env.DB_NAME || 'team_42_db',
  password: process.env.DB_PASSWORD || 'boba69',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
