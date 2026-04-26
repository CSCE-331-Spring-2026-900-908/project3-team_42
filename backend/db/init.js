const { spawnSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function initializeDB() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const usingConnectionString = Boolean(connectionString);
  if (!usingConnectionString) {
    const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD'];
    for (const key of required) {
      if (!process.env[key]) {
        console.error(`Missing ${key}. Set DATABASE_URL or set DB_HOST/DB_USER/DB_NAME/DB_PASSWORD.`);
        process.exit(1);
      }
    }
  }

  const env = {
    ...process.env,
    PGPASSWORD: process.env.DB_PASSWORD,
  };

  const run = (label, args) => {
    console.log(label);
    const result = spawnSync('psql', args, {
      cwd: __dirname,
      env,
      stdio: 'inherit',
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`psql exited with code ${result.status}`);
    }
  };

  try {
    console.log('Generating CSV seed data...');
    const gen = spawnSync('node', ['generateSeedData.js'], {
      cwd: __dirname,
      env,
      stdio: 'inherit',
    });
    if (gen.error) throw gen.error;
    if (gen.status !== 0) throw new Error(`generateSeedData.js exited with code ${gen.status}`);

    const connArgs = usingConnectionString
      ? ['-v', 'ON_ERROR_STOP=1', '-d', connectionString]
      : [
          '-v',
          'ON_ERROR_STOP=1',
          '-h',
          process.env.DB_HOST,
          '-p',
          process.env.DB_PORT || '5432',
          '-U',
          process.env.DB_USER,
          '-d',
          process.env.DB_NAME,
        ];

    run('Applying schema.sql...', [...connArgs, '-f', 'schema.sql']);
    run('Applying seed.sql...', [...connArgs, '-f', 'seed.sql']);

    console.log('Database initialized and seeded from generated CSV files.');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err.message || err);
    process.exit(1);
  }
}

initializeDB();
