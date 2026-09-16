import type { EntityWithId } from '../../shared/types/entityWithId';
import type { FilterData } from '../../shared/types/invoiceFilter';
import type { Response } from '../../shared/types/response';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { InvoiceAggregation } from '../types/InvoiceAggregation';
import { getDefaultValue } from './dbHelper';
import { mapDatabaseError } from './errorFunctions';

import { getHavingClauseFromFilters } from './filterFunctions';

export const deleteEntity = async (db: DatabaseAdapter, table: string, id: number | string) => {
   if (db.workspaceId) {
       await db.run(`DELETE FROM ${table} WHERE "id" = ? AND "workspace_id" = ?`, [id, db.workspaceId]);
   } else {
       await db.run(`DELETE FROM ${table} WHERE "id" = ?`, [id]);
   }
};

export const deleteBy = async (db: DatabaseAdapter, table: string, column: string, value: any) => {
   if (db.workspaceId) {
       await db.run(`DELETE FROM ${table} WHERE "${column}" = ? AND "workspace_id" = ?`, [value, db.workspaceId]);
   } else {
       await db.run(`DELETE FROM ${table} WHERE "${column}" = ?`, [value]);
   }
};

export const getAllEntities =
  <T extends object>(
    db: DatabaseAdapter,
    table: string,
    alias: string,
    invoiceAlias: string,
    aggregation: InvoiceAggregation
  ): ((filter: FilterData[]) => Promise<Response<(T & EntityWithCounts)[]>>) =>
  async (filter: FilterData[]) => {
    const whereWorkspace = db.workspaceId ? `WHERE ${alias}."workspace_id" = ?` : '';
    const havingClause = getHavingClauseFromFilters({
      dbType: db.type,
      filters: filter,
      invoiceUpdatedAtColumn: `${invoiceAlias}."updatedAt"`,
      invoiceIdColumn: `${invoiceAlias}."id"`,
      archivedColumn: `${alias}."isArchived"`
    });

    const sql = `
      SELECT
        ${alias}.*,
        ${aggregation.invoiceCountExpr} AS "invoiceCount",
        ${aggregation.quotesCountExpr} AS "quotesCount"
      FROM ${table} ${alias}
      ${aggregation.joins}
      ${whereWorkspace}
      GROUP BY ${alias}."id"
      ${havingClause || ''}
      ORDER BY ${alias}."createdAt" DESC
    `;

    const params = db.workspaceId ? [db.workspaceId] : [];
    const data = await db.all<T & EntityWithCounts>(sql, params);

    return { success: true, data };
  };

export const handleEntity =
  <T extends EntityWithId>(
    db: DatabaseAdapter,
    table: string,
    alias: string,
    fields: readonly (keyof T)[],
    aggregation: InvoiceAggregation
  ) =>
  async (data: T, isUpdate = false): Promise<Response<T & EntityWithCounts>> => {
    const params = fields.map(key => (data[key] ?? null) as string | number | null);
    
    // Auto-inject workspace_id
    const finalFields = db.workspaceId ? [...fields, 'workspace_id'] : [...fields];
    const finalParams = db.workspaceId ? [...params, db.workspaceId] : [...params];

    try {
      let lastID: number = -1;

      if (isUpdate) {
        const setClause =
          fields.map(f => `"${String(f)}" = ?`).join(', ') +
          `, "updatedAt" = ${getDefaultValue("(datetime('now'))", db.type)}`;
        
        if (db.workspaceId) {
           await db.run(`UPDATE ${table} SET ${setClause} WHERE "id" = ? AND "workspace_id" = ?`, [...params, data.id ?? -1, db.workspaceId], true);
        } else {
           await db.run(`UPDATE ${table} SET ${setClause} WHERE "id" = ?`, [...params, data.id ?? -1], true);
        }
        
        lastID = data.id ?? -1;
      } else {
        lastID = await db.run(
          `INSERT INTO ${table} (${finalFields.map(f => `"${String(f)}"`).join(',')})
           VALUES (${finalFields.map(() => '?').join(',')})`,
          finalParams,
          true
        );
      }

      const whereWorkspace = db.workspaceId ? `AND ${alias}."workspace_id" = ?` : '';
      const sql = `
        SELECT
          ${alias}.*,
          ${aggregation.invoiceCountExpr} AS "invoiceCount",
          ${aggregation.quotesCountExpr} AS "quotesCount"
        FROM ${table} ${alias}
        ${aggregation.joins}
        WHERE ${alias}."id" = ? ${whereWorkspace}
        GROUP BY ${alias}."id"
      `;

      const selectParams = db.workspaceId ? [lastID, db.workspaceId] : [lastID];
      const row = await db.get<T & EntityWithCounts>(sql, selectParams);

      return { success: true, data: row ?? undefined };
    } catch (error) {
      return { success: false, ...mapDatabaseError(error, db.type) };
    }
  };
