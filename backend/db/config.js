const { Pool } = require('pg');
require('dotenv').config();

const requiredDbVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD'];
for (const key of requiredDbVars) {
  if (!process.env[key]) {
    throw new Error(
      `Missing ${key}. Copy backend/.env.example to backend/.env and set database credentials (do not commit .env).`
    );
  }
}

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  end: () => pool.end(),
};
