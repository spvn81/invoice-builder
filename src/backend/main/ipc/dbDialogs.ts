import { BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'path';
import { testPostgresConnection, testMySqlConnection } from '../../shared/db/setup';
import { DatabaseType } from '../../shared/enums/databaseType';
import { DBInitType } from '../../shared/enums/dbInitType';
import type { PostgresConfig } from '../../shared/types/postgresConfig';
import type { MySqlConfig } from '../../shared/types/mysqlConfig';
import { mapDatabaseError } from '../../shared/utils/errorFunctions';
import { setupDB } from '../database';

const resetIPCHandlers = () => {
  const handlers = [
    'open-url',
    'get-all-settings',
    'update-settings',
    'add-client',
    'update-client',
    'delete-client',
    'batch-add-client',
    'get-all-clients',
    'add-business',
    'update-business',
    'delete-business',
    'batch-add-business',
    'get-all-businesses',
    'add-item',
    'update-item',
    'delete-item',
    'batch-add-item',
    'get-all-items',
    'add-unit',
    'update-unit',
    'delete-unit',
    'batch-add-unit',
    'get-all-units',
    'add-category',
    'update-category',
    'delete-category',
    'batch-add-category',
    'get-all-categories',
    'add-currency',
    'update-currency',
    'delete-currency',
    'batch-add-currency',
    'get-all-currencies',
    'get-einvoice-xml',
    'get-next-sequence',
    'get-custom-headers',
    'get-all-invoices',
    'delete-invoice',
    'update-invoice',
    'add-invoice',
    'duplicate-invoice',
    'export-all-data',
    'import-all-data',
    'restart-app',
    'get-app-version',
    'check-for-updates',
    'add-styleProfile',
    'update-styleProfile',
    'delete-styleProfile',
    'batch-add-styleProfile',
    'get-all-styleProfiles',
    'add-bank',
    'update-bank',
    'delete-bank',
    'batch-add-bank',
    'get-all-banks',
    'add-preset',
    'update-preset',
    'delete-preset',
    'batch-add-preset',
    'get-all-presets',
    'print-receipt',
    'get-all-layouts',
    'add-layout',
    'update-layout',
    'delete-layout',
    'export-layout'
  ];

  handlers.forEach(handler => ipcMain.removeHandler(handler));
};

export const initDBDialogsHandlers = (dbName: string, mainWindow: BrowserWindow) => {
  // Replaced file dialogs with workspace-scoped logic, but we still have get-all-databases
  
  // To avoid breaking renderer that might still call these, we just return empty/not-supported or fake it.
  // The correct fix is in renderer, but we satisfy backend isolation first.
  ipcMain.handle('show-save-db-dialog', async () => {
    return { success: false, message: 'File dialogs are disabled. Use workspace APIs.' };
  });
  ipcMain.handle('show-open-db-dialog', async () => {
    return { success: false, message: 'File dialogs are disabled. Use workspace APIs.' };
  });

  ipcMain.handle('get-all-databases', async () => {
    try {
      const { getLocalProfile } = await import('../profile');
      const fsPromise = await import('fs/promises');
      const fs = await import('fs');
      
      const profileId = getLocalProfile().profileId;
      const dbDir = join(process.cwd(), process.env.DB_DIRECTORY || 'data', 'users', profileId, 'databases');
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      const files = await fsPromise.readdir(dbDir);
      const dbFiles = files.filter(f => f.endsWith('.db') || f.endsWith('.sqlite') || f.endsWith('.sqlite3'));
      return { success: true, data: dbFiles };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('test-connection', async (_event, config?: PostgresConfig & { dbType?: DatabaseType }) => {
    try {
      if (config?.dbType === DatabaseType.mysql) {
        await testMySqlConnection(config);
      } else {
        await testPostgresConnection(config);
      }
      return { success: true };
    } catch (error) {
      return { success: false, ...mapDatabaseError(error, config?.dbType || DatabaseType.postgre) };
    }
  });
  ipcMain.handle(
    'initialize-db',
    async (
      _event,
      opts: { filename?: string; fullPath?: string; dbType: DatabaseType; mode?: DBInitType; postgresConfig?: PostgresConfig; mysqlConfig?: MySqlConfig }
    ) => {
      try {
        resetIPCHandlers();
        const createIfMissing = opts.mode === DBInitType.create || typeof opts.mode === 'undefined';
        
        let finalPath: string | undefined = undefined;
        
        const { getLocalProfile } = await import('../profile');
        const profileId = getLocalProfile().profileId;
        
        // Ensure path safety by only trusting filename
        if (opts.dbType === DatabaseType.sqlite) {
          const name = opts.filename || (opts.fullPath ? require('path').basename(opts.fullPath) : '');
          if (!name || name.includes('..') || require('path').isAbsolute(name) || name.includes('/') || name.includes('\\')) {
            return { success: false, key: 'error.invalidDBName' };
          }
          
          const userDbDir = join(process.cwd(), process.env.DB_DIRECTORY || 'data', 'users', profileId, 'databases');
          if (!require('fs').existsSync(userDbDir)) require('fs').mkdirSync(userDbDir, { recursive: true });
          finalPath = join(userDbDir, name);
        }

        await setupDB({
          workspaceId: profileId,
          sqliteConfig: { fullPath: finalPath },
          dbType: opts.dbType,
          createIfMissing,
          mainWindow,
          postgresConfig: opts.postgresConfig,
          mysqlConfig: opts.mysqlConfig
        });
        return { success: true };
      } catch (error) {
        return { success: false, ...mapDatabaseError(error, opts.dbType) };
      }
    }
  );
};
