import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getTableColumns } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';
import { DatabaseType } from '../enums/databaseType';

export const up = async (db: DatabaseAdapter) => {
  try {
    const tables = [
      'businesses',
      'clients',
      'units',
      'categories',
      'currencies',
      'settings',
      'presets',
      'layouts',
      'items',
      'style_profiles',
      'banks',
      'invoices',
      'invoice_items',
      'invoice_payments',
      'attachments',
      'invoice_bank_snapshots',
      'invoice_business_snapshots',
      'invoice_client_snapshots',
      'invoice_item_snapshots'
    ];

    for (const table of tables) {
       const cols = await getTableColumns(db, table);
       if (!cols.find(c => c.name === 'workspace_id')) {
          const typeDef = db.type === DatabaseType.postgre ? 'VARCHAR(36) NOT NULL DEFAULT \'default\'' : 'VARCHAR(36) NOT NULL DEFAULT "default"';
          await db.run(`ALTER TABLE ${table} ADD COLUMN "workspace_id" ${typeDef};`);
       }
    }

    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
