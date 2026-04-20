require('dotenv').config();
const db = require('./db/config');
db.query('SELECT NOW() AS current_time')
  .then(res => {
    console.log('Connection successful:', res.rows[0]);
    db.end();
  })
  .catch(err => {
    console.error('Connection failed:', err);
    db.end();
  });
