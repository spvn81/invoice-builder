import { createMysqlAdapter } from './mysql';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';

let systemDbInstance: DatabaseAdapter | null = null;

const cleanupMasterDb = async (db: DatabaseAdapter) => {
  const applicationTables = [
    'invoice_items', 'invoice_item_snapshots', 'invoice_payments', 'attachments', 
    'invoice_bank_snapshots', 'invoice_business_snapshots', 'invoice_client_snapshots',
    'invoice_currency_snapshots', 'invoice_customizations', 'invoice_layout_snapshots',
    'invoice_sequences', 'invoice_style_profile_snapshots', 'invoices', 'quotes',
    'items', 'banks', 'layouts', 'style_profiles', 'presets', 'units',
    'categories', 'currencies', 'clients', 'businesses', 'settings', 'templates', 'snapshots'
  ];

  await db.run('SET FOREIGN_KEY_CHECKS = 0;');

  for (const table of applicationTables) {
    try {
      // Check if table exists in MySQL
      const tableCheckRes = await db.query(`SHOW TABLES LIKE ?`, [table]);
      
      if (tableCheckRes.rows && tableCheckRes.rows.length > 0) {
        const rowCountRes = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
        const count = rowCountRes?.count ?? 0;
        
        if (count > 0) {
          console.warn(`[Master DB Cleanup] WARNING: Unwanted application table "${table}" contains ${count} rows! Skipping drop to prevent data loss. Manual intervention required.`);
        } else {
          await db.run(`DROP TABLE IF EXISTS ${table};`);
          console.log(`[Master DB Cleanup] Dropped empty unwanted application table: ${table}`);
        }
      }
    } catch (err) {
      console.error(`[Master DB Cleanup] Error processing table ${table}:`, err);
    }
  }

  await db.run('SET FOREIGN_KEY_CHECKS = 1;');
};

export const getSystemDb = async (): Promise<DatabaseAdapter> => {
  if (systemDbInstance) return systemDbInstance;

  // MySQL Master Database Configuration
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'invoice_builder';
  const ssl = process.env.DB_SSL === 'true';

  const mysql = await import('mysql2/promise');
  const tempConn = await mysql.createConnection({ host, port, user, password, ssl: ssl ? { rejectUnauthorized: false } : undefined });
  const [rows] = await tempConn.query('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', [database]);
  if ((rows as any[]).length === 0) {
    await tempConn.query(`CREATE DATABASE \`${database}\``);
  }
  await tempConn.end();

  const adapter = await createMysqlAdapter({
    host,
    port,
    user,
    password,
    database,
    ssl,
  });

  // MySQL Schema Initialization
  await adapter.run(
    `CREATE TABLE IF NOT EXISTS workspaces (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255),
      isLegacy TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`
  );

  await adapter.run(
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      username VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      email_verified TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      verification_token_hash VARCHAR(255),
      verification_token_expires_at DATETIME,
      default_workspace_id VARCHAR(36),
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(default_workspace_id) REFERENCES workspaces(id)
    );`
  );

  await adapter.run(
    `CREATE TABLE IF NOT EXISTS user_databases (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      workspace_id VARCHAR(36) NOT NULL,
      database_name VARCHAR(255) NOT NULL,
      database_path VARCHAR(1024) NOT NULL,
      database_type VARCHAR(50) NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'ready',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
    );`
  );

  await cleanupMasterDb(adapter);

  systemDbInstance = adapter;
  return adapter;
};

