import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { DatabaseType } from '../enums/databaseType';

export class TenantQueryBuilder {
  constructor(private db: DatabaseAdapter) {}

  private get requiresWorkspaceScoping() {
     // Local SQLite databases are physically isolated per user and do not require workspace_id columns
     // Shared databases (MySQL/PostgreSQL) require workspace_id row-level isolation
     return this.db.type !== DatabaseType.sqlite; 
  }

  async deleteById(table: string, id: number | string): Promise<void> {
    if (this.requiresWorkspaceScoping && this.db.workspaceId) {
      await this.db.run(`DELETE FROM ${table} WHERE "id" = ? AND "workspace_id" = ?`, [id, this.db.workspaceId]);
    } else {
      await this.db.run(`DELETE FROM ${table} WHERE "id" = ?`, [id]);
    }
  }

  async deleteBy(table: string, column: string, value: any): Promise<void> {
    if (this.requiresWorkspaceScoping && this.db.workspaceId) {
       await this.db.run(`DELETE FROM ${table} WHERE "${column}" = ? AND "workspace_id" = ?`, [value, this.db.workspaceId]);
    } else {
       await this.db.run(`DELETE FROM ${table} WHERE "${column}" = ?`, [value]);
    }
  }

  async updateField(table: string, id: number | string, setClause: string, params: any[]): Promise<void> {
    if (this.requiresWorkspaceScoping && this.db.workspaceId) {
       await this.db.run(`UPDATE ${table} SET ${setClause} WHERE "id" = ? AND "workspace_id" = ?`, [...params, id, this.db.workspaceId], true);
    } else {
       await this.db.run(`UPDATE ${table} SET ${setClause} WHERE "id" = ?`, [...params, id], true);
    }
  }

  async getById<T = any>(table: string, id: number | string): Promise<T | null> {
    let res;
    if (this.requiresWorkspaceScoping && this.db.workspaceId) {
      res = await this.db.get(`SELECT * FROM ${table} WHERE "id" = ? AND "workspace_id" = ?`, [id, this.db.workspaceId]);
    } else {
      res = await this.db.get(`SELECT * FROM ${table} WHERE "id" = ?`, [id]);
    }
    return res ? (res as T) : null;
  }
}
