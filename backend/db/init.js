const fs = require('fs');
const path = require('path');
const db = require('./config');

async function initializeDB() {
    try {
        console.log('Reading schema.sql...');
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        await db.query(schema);
        console.log('Schema created successfully.');

        console.log('Reading seed.sql...');
        const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
        await db.query(seed);
        console.log('Database seeded successfully.');

        process.exit(0);
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

initializeDB();
