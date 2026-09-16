import fs from 'fs';
import path from 'path';
import { createSqliteAdapter } from './client';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { APP_CONFIG } from '../../webserver/config';

let systemDbInstance: DatabaseAdapter | null = null;

export const getSystemDb = async (): Promise<DatabaseAdapter> => {
  if (systemDbInstance) return systemDbInstance;

  const dbDir = path.resolve(process.cwd(), process.env.DB_DIRECTORY || APP_CONFIG?.DB_DIRECTORY || 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const systemDbPath = path.resolve(dbDir, 'system.db');
  
  const sqlite3 = await import('sqlite3');
  const db = new sqlite3.default.Database(systemDbPath);
  
  const adapter = createSqliteAdapter(db);
  await adapter.run('PRAGMA foreign_keys = ON;');
  
  await adapter.run(
    `CREATE TABLE IF NOT EXISTS workspaces (
      "id" VARCHAR(36) PRIMARY KEY,
      "name" TEXT,
      "isLegacy" INTEGER NOT NULL DEFAULT 0 CHECK ("isLegacy" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    );`
  );

  await adapter.run(
    `CREATE TABLE IF NOT EXISTS users (
      "id" VARCHAR(36) PRIMARY KEY,
      "email" VARCHAR(255) UNIQUE,
      "username" VARCHAR(255) UNIQUE,
      "password_hash" VARCHAR(255) NOT NULL,
      "email_verified" INTEGER NOT NULL DEFAULT 0 CHECK ("email_verified" IN (0,1)),
      "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
      "verification_token_hash" VARCHAR(255),
      "verification_token_expires_at" DATETIME,
      "default_workspace_id" VARCHAR(36),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY("default_workspace_id") REFERENCES workspaces("id")
    );`
  );

  await adapter.run(
    `CREATE TABLE IF NOT EXISTS user_databases (
      "id" VARCHAR(36) PRIMARY KEY,
      "user_id" VARCHAR(36) NOT NULL,
      "workspace_id" VARCHAR(36) NOT NULL,
      "database_name" VARCHAR(255) NOT NULL,
      "database_path" TEXT NOT NULL,
      "database_type" VARCHAR(50) NOT NULL,
      "is_default" INTEGER NOT NULL DEFAULT 0 CHECK ("is_default" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY("user_id") REFERENCES users("id"),
      FOREIGN KEY("workspace_id") REFERENCES workspaces("id")
    );`
  );

  systemDbInstance = adapter;
  return adapter;
};
