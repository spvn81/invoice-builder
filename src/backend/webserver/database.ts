import fs from 'fs';
import path from 'path';
import { initInitialData, initSchema, openPostgreSql, openSqlLite, openMySql } from '../shared/db/setup';
import { DatabaseType } from '../shared/enums/databaseType';
import type { DatabaseAdapter } from '../shared/types/DatabaseAdapter';
import type { PostgresConfig } from '../shared/types/postgresConfig';
import type { SqLiteConfig } from '../shared/types/sqliteConfig';
import type { MySqlConfig } from '../shared/types/mysqlConfig';
import { runMigrations } from './migration';

const dbInstances = new Map<string, DatabaseAdapter>();

export const getDbForWorkspace = (workspaceId: string): DatabaseAdapter => {
  const db = dbInstances.get(workspaceId);
  if (!db) {
    throw new Error('error.databaseNotInitialized');
  }
  return db;
};

export const clearDbForWorkspace = async (workspaceId: string): Promise<void> => {
  const db = dbInstances.get(workspaceId);
  if (db) {
    try { await db.close(); } catch (e) { /* ignore */ }
    dbInstances.delete(workspaceId);
  }
};

export const setupDB = async (opts: {
  workspaceId: string;
  dbType: DatabaseType;
  createIfMissing?: boolean;
  postgresConfig?: PostgresConfig;
  sqliteConfig?: SqLiteConfig;
  mysqlConfig?: MySqlConfig;
}): Promise<void> => {
  const { workspaceId, sqliteConfig, createIfMissing = true, dbType, postgresConfig, mysqlConfig } = opts;

  await clearDbForWorkspace(workspaceId);

  let newDb: DatabaseAdapter | null = null;

  if (dbType === DatabaseType.postgre) {
    if (!postgresConfig) throw new Error('error.postgresConfig');
    const { db } = await openPostgreSql(postgresConfig);
    newDb = db;
  } else if (dbType === DatabaseType.sqlite) {
    if (sqliteConfig?.fullPath) fs.mkdirSync(path.dirname(sqliteConfig?.fullPath), { recursive: true });
    const { db } = await openSqlLite({ fullPath: sqliteConfig?.fullPath, createIfMissing: createIfMissing });
    newDb = db;
  } else if (dbType === DatabaseType.mysql) {
    if (!mysqlConfig) throw new Error('error.mysqlConfig');
    const { db } = await openMySql(mysqlConfig);
    newDb = db;
  }

  if (!newDb) throw new Error('error.noDatabase');

  if (dbType !== DatabaseType.sqlite) {
    newDb.workspaceId = workspaceId;
  }

  if (createIfMissing) {
    await initSchema(newDb);
    await initInitialData(newDb);
  }

  const migrationResult = await runMigrations(newDb);
  if (migrationResult && !migrationResult.success) {
    throw new Error(migrationResult.message ?? 'error.failedMigration');
  }

  dbInstances.set(workspaceId, newDb);
};
