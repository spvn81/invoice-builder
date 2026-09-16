const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

async function run() {
  const dataDir = path.resolve(__dirname, 'data');
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(dataDir, { recursive: true });

  const systemDbPath = path.resolve(dataDir, 'system.db');
  const db = new sqlite3.Database(systemDbPath);

  const runSql = (sql) => new Promise((resolve, reject) => db.run(sql, err => err ? reject(err) : resolve()));

  // Simulate an old monolithic database
  await runSql(`CREATE TABLE users (id TEXT, email TEXT)`);
  await runSql(`CREATE TABLE workspaces (id TEXT, name TEXT)`);
  await runSql(`CREATE TABLE invoices (id TEXT, total INTEGER)`); // Empty application table
  await runSql(`CREATE TABLE businesses (id TEXT, name TEXT)`); // Non-empty application table
  await runSql(`INSERT INTO businesses (id, name) VALUES ('b1', 'Test Biz')`);
  
  db.close();
  console.log('Simulated monolithic database created.');

  // Now compile and run the actual systemDb code to see if it cleans it up
  const { execSync } = require('child_process');
  
  try {
    console.log('Running tests using npx tsx...');
    execSync('npx tsx src/backend/shared/db/systemDb.ts', { stdio: 'inherit' });
  } catch (err) {
    // If it fails, we will just write a wrapper script.
  }
}

run().catch(console.error);
