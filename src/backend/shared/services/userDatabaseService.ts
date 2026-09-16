import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getSystemDb } from '../db/systemDb';
import { setupDB } from '../../webserver/database';
import { DatabaseType } from '../enums/databaseType';
import crypto from 'crypto';
import { APP_CONFIG } from '../../webserver/config';
import { DatabaseAdapter } from '../types/DatabaseAdapter';

export const dbDir = path.resolve(process.cwd(), process.env.DB_DIRECTORY || APP_CONFIG?.DB_DIRECTORY || 'data');

export const getUserDbDir = (userId: string) => {
  const dir = path.join(dbDir, 'users', userId, 'databases');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Database Status enum (matches MySQL)
export enum DbStatus {
  PROVISIONING = 'provisioning',
  READY = 'ready',
  MISSING = 'missing',
  CORRUPT = 'corrupt',
  FAILED = 'failed'
}

export interface UserDatabase {
  id: string;
  name: string;
  status: DbStatus;
  isDefault: boolean;
  databaseType: string;
  createdAt: string;
}

// Global in-memory Mutex to prevent Node concurrent provisioning
const provisioningLocks = new Map<string, Promise<void>>();

async function executeWithLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const existingLock = provisioningLocks.get(userId);
  if (existingLock) {
    await existingLock;
  }
  let lockResolver: () => void;
  const newLock = new Promise<void>((resolve) => {
    lockResolver = resolve;
  });
  provisioningLocks.set(userId, newLock);

  try {
    return await fn();
  } finally {
    lockResolver!();
    provisioningLocks.delete(userId);
  }
}

/**
 * Ensures exactly one safe default DB exists for the user.
 * 
 * Returns { validDbCount: number, databases: UserDatabase[], databaseSelectionRequired: boolean, defaultDb?: UserDatabase }
 */
export const ensureDefaultUserDatabase = async (userId: string) => {
  return executeWithLock(userId, async () => {
    const systemDb = await getSystemDb();

    // Re-read inside lock + transaction
    let userDatabases = await _resolveUserDatabasesInternal(userId, systemDb);
    let validDbs = userDatabases.filter(db => db.status === DbStatus.READY);

    if (validDbs.length === 0) {
      // 0 valid DBs: Provision one
      const newDb = await _provisionUserLocalDbInternal(userId, true, systemDb);
      // reload
      userDatabases = await _resolveUserDatabasesInternal(userId, systemDb);
      validDbs = userDatabases.filter(db => db.status === DbStatus.READY);
    }

    if (validDbs.length === 1) {
      // Auto open it by invoking setupDB via openUserDatabase logic
      const targetDb = validDbs[0];
      await _openUserDatabaseInternal(userId, targetDb.id, systemDb);
      return {
        validDbCount: 1,
        databases: userDatabases,
        databaseSelectionRequired: false,
        defaultDb: targetDb
      };
    }

    return {
      validDbCount: validDbs.length,
      databases: userDatabases,
      databaseSelectionRequired: true
    };
  });
};

/**
 * Re-reads and verifies all user databases. Updates statuses safely.
 */
export const resolveUserDatabases = async (userId: string): Promise<UserDatabase[]> => {
  return executeWithLock(userId, async () => {
    const systemDb = await getSystemDb();
    return _resolveUserDatabasesInternal(userId, systemDb);
  });
};

/**
 * Creates a new user database securely and safely.
 */
export const provisionUserLocalDb = async (userId: string, isDefault = false): Promise<UserDatabase> => {
  return executeWithLock(userId, async () => {
    const systemDb = await getSystemDb();
    return _provisionUserLocalDbInternal(userId, isDefault, systemDb);
  });
};

export const openUserDatabase = async (userId: string, databaseId: string): Promise<void> => {
  return executeWithLock(userId, async () => {
    const systemDb = await getSystemDb();
    await _openUserDatabaseInternal(userId, databaseId, systemDb);
  });
};

export const createUserDatabase = async (userId: string, databaseName: string): Promise<UserDatabase> => {
  return executeWithLock(userId, async () => {
    const systemDb = await getSystemDb();
    
    // Validate path traversal
    if (databaseName.includes('..') || path.isAbsolute(databaseName) || databaseName.includes('/') || databaseName.includes('\\')) {
      throw new Error('error.invalidDBName');
    }

    const safeName = databaseName.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const userDbDir = getUserDbDir(userId);
    const fullPath = path.join(userDbDir, safeName);
    
    if (fs.existsSync(fullPath)) {
      throw new Error('error.dbAlreadyExists');
    }

    return _provisionUserLocalDbInternal(userId, false, systemDb, safeName);
  });
};

export const deleteUserDatabase = async (userId: string, databaseId: string): Promise<void> => {
  return executeWithLock(userId, async () => {
    const systemDb = await getSystemDb();
    
    // Check if it's the last ready DB
    const allDbs = await _resolveUserDatabasesInternal(userId, systemDb);
    const readyDbs = allDbs.filter(db => db.status === DbStatus.READY);
    
    if (readyDbs.length <= 1 && readyDbs.some(db => db.id === databaseId)) {
      throw new Error('error.cannotDeleteLastReadyDatabase');
    }

    const dbRes = await systemDb.query('SELECT * FROM user_databases WHERE id = ? AND user_id = ?', [databaseId, userId]);
    if (!dbRes.rows || dbRes.rows.length === 0) {
      throw new Error('error.databaseNotFound');
    }

    const dbMeta = dbRes.rows[0] as any;
    const userDbDir = getUserDbDir(userId);
    const fullPath = path.join(userDbDir, dbMeta.database_name);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await systemDb.run('DELETE FROM user_databases WHERE id = ?', [databaseId]);
  });
};

/**
 * INTERNAL WORKER: Resolves user DBs, verifies physical files, marks broken paths.
 */
async function _resolveUserDatabasesInternal(userId: string, systemDb: DatabaseAdapter): Promise<UserDatabase[]> {
  const dbRes = await systemDb.query('SELECT * FROM user_databases WHERE user_id = ?', [userId]);
  const rows = dbRes.rows || [];
  
  const results: UserDatabase[] = [];

  for (const row of rows) {
    const rowDb = row as any;
    let currentStatus = rowDb.status as DbStatus;
    
    const dbName = String(rowDb.database_name || '');
    if (!dbName) continue;
    
    const userDbDir = getUserDbDir(userId);
    const expectedPath = path.join(userDbDir, dbName);
    
    if (currentStatus === DbStatus.READY || currentStatus === DbStatus.PROVISIONING) {
      // Validate existence
      if (!fs.existsSync(expectedPath)) {
        currentStatus = DbStatus.MISSING;
        await systemDb.run('UPDATE user_databases SET status = ? WHERE id = ?', [currentStatus, rowDb.id]);
      } else {
        // Technically, a full integrity check could be done, but for now we just assume ready if it exists and is not empty.
        // We handle corrupt logic inside setupDB when it fails to open/initialize.
        currentStatus = DbStatus.READY;
        if (rowDb.status !== DbStatus.READY) {
           await systemDb.run('UPDATE user_databases SET status = ? WHERE id = ?', [currentStatus, rowDb.id]);
        }
      }
    }

    results.push({
      id: rowDb.id,
      name: rowDb.database_name,
      status: currentStatus,
      isDefault: Boolean(rowDb.is_default),
      databaseType: rowDb.database_type,
      createdAt: rowDb.created_at || new Date().toISOString()
    });
  }

  return results;
}

/**
 * INTERNAL WORKER: Provisions exactly 1 user database. 
 * Acquires a MySQL lock.
 */
async function _provisionUserLocalDbInternal(userId: string, isDefault: boolean, systemDb: DatabaseAdapter, requestedName?: string): Promise<UserDatabase> {
  const lockName = `provision_db_${userId}`;
  
  // Try MySQL GET_LOCK for multi-server safety
  const lockRes = await systemDb.query('SELECT GET_LOCK(?, 10) as lk', [lockName]);
  const acquired = lockRes.rows?.[0]?.lk === 1;

  try {
    // Re-verify if another process provisioned it.
    if (isDefault) {
       const userDatabases = await _resolveUserDatabasesInternal(userId, systemDb);
       const validDbs = userDatabases.filter(db => db.status === DbStatus.READY);
       if (validDbs.length > 0) {
         return validDbs[0];
       }
    }

    const usernameRes = await systemDb.query('SELECT default_workspace_id FROM users WHERE id = ?', [userId]);
    if (!usernameRes.rows || usernameRes.rows.length === 0) {
      throw new Error('User not found in system db.');
    }
    const workspaceId = (usernameRes.rows[0] as any).default_workspace_id;

    let databaseName = requestedName;
    if (!databaseName) {
      const hash = crypto.randomBytes(4).toString('hex');
      databaseName = `user_${hash}.db`;
    }

    const userDbDir = getUserDbDir(userId);
    const fullPath = path.join(userDbDir, databaseName);

    const dbId = uuidv4();
    
    // Mark provisioning
    await systemDb.run(
      `INSERT INTO user_databases (id, user_id, workspace_id, database_name, database_path, database_type, is_default, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [dbId, userId, workspaceId, databaseName, fullPath, DatabaseType.sqlite, isDefault ? 1 : 0, DbStatus.PROVISIONING]
    );

    try {
      // 8, 9, 10: Run local SQLite migrations & initInitialData
      await setupDB({
        workspaceId,
        dbType: DatabaseType.sqlite,
        createIfMissing: true,
        sqliteConfig: { fullPath }
      });

      // Verification open succeeded, mark Ready
      await systemDb.run('UPDATE user_databases SET status = ? WHERE id = ?', [DbStatus.READY, dbId]);
      
      return {
        id: dbId,
        name: databaseName,
        status: DbStatus.READY,
        isDefault,
        databaseType: DatabaseType.sqlite,
        createdAt: new Date().toISOString()
      };
    } catch (err: any) {
      console.error('Failed to initialize local user DB:', err);
      // Mark failed
      await systemDb.run('UPDATE user_databases SET status = ? WHERE id = ?', [DbStatus.FAILED, dbId]);
      throw new Error(`error.failedDatabaseProvisioning: ${err?.message || err}`);
    }
  } finally {
    if (acquired) {
      await systemDb.run('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  }
}

/**
 * INTERNAL WORKER: Validates ownership and sets up the active connection map for a specific database.
 */
async function _openUserDatabaseInternal(userId: string, databaseId: string, systemDb: DatabaseAdapter): Promise<void> {
  const dbRes = await systemDb.query('SELECT * FROM user_databases WHERE id = ? AND user_id = ?', [databaseId, userId]);
  if (!dbRes.rows || dbRes.rows.length === 0) {
    throw new Error('error.databaseNotFound');
  }

  const dbMeta = dbRes.rows[0] as any;
  const userDbDir = getUserDbDir(userId);
  const fullPath = path.join(userDbDir, dbMeta.database_name);

  if (!fs.existsSync(fullPath)) {
    await systemDb.run('UPDATE user_databases SET status = ? WHERE id = ?', [DbStatus.MISSING, databaseId]);
    throw new Error('error.dbFileNotFound');
  }

  try {
    await setupDB({
      workspaceId: dbMeta.workspace_id,
      dbType: dbMeta.database_type as DatabaseType,
      createIfMissing: false,
      sqliteConfig: { fullPath }
    });
    // Set status to ready in case it was missing/corrupt before but works now
    await systemDb.run('UPDATE user_databases SET status = ? WHERE id = ?', [DbStatus.READY, databaseId]);
  } catch (err) {
    await systemDb.run('UPDATE user_databases SET status = ? WHERE id = ?', [DbStatus.CORRUPT, databaseId]);
    throw new Error('error.dbCorrupt');
  }
}
