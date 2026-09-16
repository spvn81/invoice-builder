import type { BrowserWindow } from 'electron';
import { initInitialData, initSchema, openPostgreSql, openSqlLite } from '../shared/db/setup';
import { DatabaseType } from '../shared/enums/databaseType';
import type { DatabaseAdapter } from '../shared/types/DatabaseAdapter';
import type { PostgresConfig } from '../shared/types/postgresConfig';
import type { SqLiteConfig } from '../shared/types/sqliteConfig';
import type { MySqlConfig } from '../shared/types/mysqlConfig';
import { initIpcHandler } from './ipc';
import { runMigrations } from './migration';
import { openMySql } from '../shared/db/setup';

let dbInstance: DatabaseAdapter | null = null;

const setupDB = async (opts: {
  dbType: DatabaseType;
  workspaceId?: string;
  createIfMissing?: boolean;
  postgresConfig?: PostgresConfig;
  sqliteConfig?: SqLiteConfig;
  mysqlConfig?: MySqlConfig;
  mainWindow: BrowserWindow;
}) => {
  const { sqliteConfig, createIfMissing = true, mainWindow, dbType, postgresConfig, mysqlConfig, workspaceId } = opts;

  if (dbInstance) {
    await (dbInstance as DatabaseAdapter).close();
    dbInstance = null;
  }

  if (dbType === DatabaseType.postgre) {
    if (!postgresConfig) throw new Error('error.postgresConfig');
    const { db: newDb } = await openPostgreSql(postgresConfig);
    dbInstance = newDb;
  } else if (dbType === DatabaseType.sqlite) {
    const { db: newDb } = await openSqlLite({ fullPath: sqliteConfig?.fullPath, createIfMissing: createIfMissing });
    dbInstance = newDb;
  } else if (dbType === DatabaseType.mysql) {
    if (!mysqlConfig) throw new Error('error.mysqlConfig');
    const { db: newDb } = await openMySql(mysqlConfig);
    dbInstance = newDb;
  }

  if (!dbInstance) throw new Error('error.noDatabase');

  if (dbType !== DatabaseType.sqlite) {
    dbInstance.workspaceId = workspaceId;
  }

  if (createIfMissing) {
    await initSchema(dbInstance);
    await initInitialData(dbInstance);
  }

  const migrationResult = await runMigrations(dbInstance);
  if (migrationResult && !migrationResult.success) {
    throw new Error(migrationResult.message ?? 'error.failedMigration');
  }

  initIpcHandler(dbInstance, mainWindow);
};

export { dbInstance as db, setupDB };
