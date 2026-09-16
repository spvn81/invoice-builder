import mysql, { PoolConnection } from 'mysql2/promise';
import { DatabaseType } from '../enums/databaseType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import {
  boolToInt,
  convertBooleanFields,
  convertBooleanFieldsArray,
  convertDateFields,
  convertDateFieldsArray
} from '../utils/dbHelper';
import type { MySqlConfig } from '../types/mysqlConfig';

export const createMysqlAdapter = async (config: MySqlConfig): Promise<DatabaseAdapter> => {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
    timezone: '+00:00'
  });

  // Enable ANSI_QUOTES mode to allow double quotes for identifiers,
  // matching SQLite and PostgreSQL query syntax.
  pool.on('connection', (connection) => {
    connection.query('SET SESSION sql_mode = CONCAT(@@sql_mode, ",ANSI_QUOTES")');
  });

  let connectionInTransaction: PoolConnection | null = null;

  const acquireConnection = async () => {
    if (connectionInTransaction) return connectionInTransaction;
    connectionInTransaction = await pool.getConnection();
    return connectionInTransaction;
  };

  const releaseConnection = async () => {
    if (connectionInTransaction) {
      try {
        connectionInTransaction.release();
      } catch {
        throw new Error(`error.failedMySQLrelease`);
      }
      connectionInTransaction = null;
    }
  };

  const runQuery = async (sql: string, params: unknown[] = []) => {
    let text = sql;

    // MySQL strict mode does not allow TEXT/BLOB columns to have DEFAULT values,
    // and TEXT columns cannot be UNIQUE without a prefix length.
    // Since the original SQLite schema heavily uses TEXT, we intercept 
    // and convert these to VARCHAR(255) before execution.
    text = text.replace(/\bTEXT\s+NOT\s+NULL\s+DEFAULT\b/gi, 'VARCHAR(255) NOT NULL DEFAULT');
    text = text.replace(/\bTEXT\s+DEFAULT\b/gi, 'VARCHAR(255) DEFAULT');
    
    // Targeted replacements for columns that are indexed or UNIQUE across all migrations
    text = text.replace(/"name"\s+TEXT/gi, '"name" VARCHAR(255)');
    text = text.replace(/"code"\s+TEXT/gi, '"code" VARCHAR(255)');
    text = text.replace(/"invoiceNumber"\s+TEXT/gi, '"invoiceNumber" VARCHAR(255)');
    text = text.replace(/"invoiceFullNumber"\s+TEXT/gi, '"invoiceFullNumber" VARCHAR(255)');
    text = text.replace(/"invoiceType"\s+TEXT/gi, '"invoiceType" VARCHAR(255)');
    text = text.replace(/"status"\s+TEXT/gi, '"status" VARCHAR(255)');

    // MySQL does not allow CHECK constraints to refer to AUTO_INCREMENT columns.
    text = text.replace(/,\s*CHECK\s*\(\s*"convertedFromQuotationId"\s*IS\s*NULL\s*OR\s*"convertedFromQuotationId"\s*!=\s*"id"\s*\)/gi, '');

    // MySQL does not support CREATE INDEX IF NOT EXISTS.
    text = text.replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE INDEX');

    const trimmed = text.trim().toUpperCase();
    if (trimmed === 'BEGIN' || trimmed.startsWith('BEGIN ')) {
      const conn = await acquireConnection();
      await conn.query('START TRANSACTION');
      return { rows: [], insertId: 0, affectedRows: 0 };
    }
    if (trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      if (!connectionInTransaction) {
        return { rows: [], insertId: 0, affectedRows: 0 };
      }
      try {
        const [res] = await connectionInTransaction.query(trimmed);
        return {
          rows: Array.isArray(res) ? res : [],
          insertId: res && 'insertId' in res ? res.insertId : 0,
          affectedRows: res && 'affectedRows' in res ? res.affectedRows : 0
        };
      } catch (err: any) {
        if (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061) {
          return { rows: [], insertId: 0, affectedRows: 0 };
        }
        throw err;
      } finally {
        await releaseConnection();
      }
    }

    if (connectionInTransaction) {
      try {
        const [res] = await connectionInTransaction.query(text, params);
        return {
          rows: Array.isArray(res) ? res : [res],
          insertId: res && 'insertId' in res ? res.insertId : 0,
          affectedRows: res && 'affectedRows' in res ? res.affectedRows : 0
        };
      } catch (err: any) {
        if (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061) {
          return { rows: [], insertId: 0, affectedRows: 0 };
        }
        throw err;
      }
    }

    try {
      const [res] = await pool.query(text, params);
      return {
        rows: Array.isArray(res) ? res : [res],
        insertId: res && 'insertId' in res ? res.insertId : 0,
        affectedRows: res && 'affectedRows' in res ? res.affectedRows : 0
      };
    } catch (err: any) {
      if (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061) {
        return { rows: [], insertId: 0, affectedRows: 0 };
      }
      console.error('MySQL Query Failed:', text, err);
      throw err;
    }
  };

  return {
    type: DatabaseType.mysql,
    run: async (sql: string, params: unknown[] = [], returningId = false) => {
      const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
      const isUpdate = sql.trim().toUpperCase().startsWith('UPDATE');

      if (isInsert || isUpdate) {
        params = params.map(boolToInt);
      }

      const res = await runQuery(sql, params);
      if (isInsert && returningId) {
        return res.insertId ?? -1;
      }
      return res.affectedRows ?? 0;
    },
    get: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
      const res = await runQuery(sql, params);
      if (!res.rows[0]) return null;
      const convertedBooleanRow = convertBooleanFields(res.rows[0] as Record<string, unknown>);
      const convertedDateRow = convertDateFields(convertedBooleanRow as Record<string, unknown>);

      return convertedDateRow as T;
    },
    all: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
      const res = await runQuery(sql, params);
      const convertedBooleanRow = convertBooleanFieldsArray(res.rows as Record<string, unknown>[]);
      const convertedDateRow = convertDateFieldsArray(convertedBooleanRow as Record<string, unknown>[]);

      return convertedDateRow as T[];
    },
    query: async (sql: string, params: unknown[] = []) => {
      const res = await runQuery(sql, params);
      const convertedBooleanRow = convertBooleanFieldsArray(res.rows as Record<string, unknown>[]);
      const convertedDateRow = convertDateFieldsArray(convertedBooleanRow as Record<string, unknown>[]);

      return { rows: convertedDateRow };
    },
    close: async () => {
      await releaseConnection();
      await pool.end();
    }
  };
};
