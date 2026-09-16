import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getTableColumns } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';
import { DatabaseType } from '../enums/databaseType';

export const up = async (db: DatabaseAdapter) => {
  try {
    // This corrective migration ONLY targets SQLite local databases
    if (db.type !== DatabaseType.sqlite) {
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
       if (cols.find(c => c.name === 'workspace_id')) {
          // SQLite natively supports dropping columns as of 3.35.0 (which is bundled in any modern Node 18+ environment)
          // Using ALTER TABLE ... DROP COLUMN to remove the erroneously injected tenant column from physical local files.
          await db.run(`ALTER TABLE ${table} DROP COLUMN "workspace_id";`);
       }
    }

    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
