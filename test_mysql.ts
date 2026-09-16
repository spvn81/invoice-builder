import { getSystemDb } from './src/backend/shared/db/systemDb';

async function main() {
  try {
    console.log('Initializing system database (MySQL)...');
    const db = await getSystemDb();
    console.log('Database initialized successfully.');
    
    console.log('Checking tables...');
    const tables = await db.query('SHOW TABLES;');
    console.log('Tables:', tables.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
