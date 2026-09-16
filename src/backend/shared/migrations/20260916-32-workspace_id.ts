import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getTableColumns } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';
import { DatabaseType } from '../enums/databaseType';

export const up = async (db: DatabaseAdapter) => {
  try {
    if (db.type === DatabaseType.sqlite) {
      return { success: true };
    }

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
      'invoice_item_snapshots',
      'invoice_currency_snapshots',
      'invoice_customizations',
      'invoice_style_profile_snapshots',
      'invoice_sequences',
      'invoice_layout_snapshots'
    ];

    for (const table of tables) {
       const cols = await getTableColumns(db, table);
       if (!cols.find(c => c.name === 'workspace_id')) {
          const typeDef = "VARCHAR(36) NOT NULL DEFAULT 'default'";
          await db.run(`ALTER TABLE ${table} ADD COLUMN "workspace_id" ${typeDef};`);
       }
    }

    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
