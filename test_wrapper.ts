import { getSystemDb } from './src/backend/shared/db/systemDb';

async function main() {
  const db = await getSystemDb();
  
  // Verify which tables exist
  const res = await db.query('SELECT name FROM sqlite_master WHERE type="table"');
  console.log('Tables in master DB:', res.rows?.map((r: any) => r.name));
  
  process.exit(0);
}

main().catch(console.error);
