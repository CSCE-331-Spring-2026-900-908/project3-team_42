const { Pool } = require('pg');
require('dotenv').config();

let pool;

if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (connectionString) {
    // Strip out channel_binding parameters that the node `pg` driver struggles with
    connectionString = connectionString.replace(/[\?&]channel_binding=require/g, '');
    connectionString = connectionString.replace(/\?&/, '?').replace(/[?&]$/, ''); // Cleanup trailing or dangling symbols

    // Implicitly use connection pooling for Neon to prevent connection exhaustion in serverless apps
    if (connectionString.includes('.neon.tech') && !connectionString.includes('-pooler')) {
      connectionString = connectionString.replace('.neon.tech', '-pooler.neon.tech');
    }
  }

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

  let host = process.env.DB_HOST;

  // Implicitly use connection pooling for Neon to prevent connection exhaustion in serverless apps
  if (host && host.includes('.neon.tech') && !host.includes('-pooler')) {
    host = host.replace('.neon.tech', '-pooler.neon.tech');
  }

  pool = new Pool({
    host: host,
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
  connect: () => pool.connect(),
  end: () => pool.end(),
};
