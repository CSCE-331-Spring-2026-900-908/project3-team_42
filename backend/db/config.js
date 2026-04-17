const { Pool } = require('pg');
require('dotenv').config();

let pool;

if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  const requiredDbVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD'];
  for (const key of requiredDbVars) {
    if (!process.env[key]) {
      throw new Error(
        `Missing DB variables. Ensure DATABASE_URL is set, or ALL of DB_HOST, DB_USER, DB_NAME, DB_PASSWORD are set.`
      );
    }
  }

  pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: {
      rejectUnauthorized: false
    }
  });
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  end: () => pool.end(),
};
