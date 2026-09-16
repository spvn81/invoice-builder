import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getTableColumns } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';
import { DatabaseType } from '../enums/databaseType';

export const up = async (db: DatabaseAdapter) => {
  try {
    const cols = await getTableColumns(db, 'style_profiles');
    const labelUpperCaseInfo = cols.find(c => c.name === 'labelUpperCase');

    // If it's already renamed, do nothing
    if (labelUpperCaseInfo) {
      return { success: true };
    }

    if (db.type === DatabaseType.mysql) {
      // In MySQL 8, RENAME COLUMN fails if there is a CHECK constraint.
      // We must drop the CHECK constraint before renaming.
      // Also, we must join with TABLE_CONSTRAINTS to filter by table name correctly.
      const res = await db.query(
        `SELECT c.CONSTRAINT_NAME 
         FROM information_schema.CHECK_CONSTRAINTS c
         JOIN information_schema.TABLE_CONSTRAINTS t ON c.CONSTRAINT_NAME = t.CONSTRAINT_NAME 
         WHERE t.TABLE_SCHEMA = DATABASE() 
           AND t.TABLE_NAME = 'style_profiles' 
           AND (c.CHECK_CLAUSE LIKE '%customizationLabelUpperCase%' OR c.CHECK_CLAUSE LIKE '%labelUpperCase%')`
      );
      
      const rows = res.rows as any[];
      for (const row of rows) {
        if (row.CONSTRAINT_NAME) {
          try {
            await db.run(`ALTER TABLE style_profiles DROP CHECK \`${row.CONSTRAINT_NAME}\``);
          } catch (e) {
            console.log('Failed to drop check constraint', row.CONSTRAINT_NAME, e);
          }
        }
      }
    }

    // Now rename the columns that were missed in migration 06
    const columnsToRename = [
      ['customizationLabelUpperCase', 'labelUpperCase', 'INTEGER NOT NULL DEFAULT 0 CHECK ("labelUpperCase" IN (0,1))'],
      ['customizationWatermarkFileName', 'watermarkFileName', 'TEXT'],
      ['customizationWatermarkFileType', 'watermarkFileType', 'TEXT'],
      ['customizationWatermarkFileSize', 'watermarkFileSize', 'INTEGER'],
      ['customizationWatermarkFileData', 'watermarkFileData', 'BLOB'],
      ['customizationPaidWatermarkFileName', 'paidWatermarkFileName', 'TEXT'],
      ['customizationPaidWatermarkFileType', 'paidWatermarkFileType', 'TEXT'],
      ['customizationPaidWatermarkFileSize', 'paidWatermarkFileSize', 'INTEGER'],
      ['customizationPaidWatermarkFileData', 'paidWatermarkFileData', 'BLOB']
    ];

    for (const [oldCol, newCol, typeDef] of columnsToRename) {
      const oldColExists = cols.find(c => c.name === oldCol);
      if (oldColExists) {
        try {
          await db.run(`ALTER TABLE style_profiles RENAME COLUMN "${oldCol}" TO "${newCol}";`);
        } catch (renameError) {
          if (db.type === DatabaseType.mysql) {
             // Fallback for older MySQL versions that do not support RENAME COLUMN
             await db.run(`ALTER TABLE style_profiles CHANGE COLUMN "${oldCol}" "${newCol}" ${typeDef};`);
          } else {
             throw renameError;
          }
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
