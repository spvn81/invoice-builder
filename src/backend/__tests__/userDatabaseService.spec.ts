import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { 
  resolveUserDatabases, 
  provisionUserLocalDb, 
  ensureDefaultUserDatabase,
  openUserDatabase,
  createUserDatabase,
  dbDir,
  DbStatus
} from '../shared/services/userDatabaseService';
import { getSystemDb, closeSystemDb } from '../shared/db/systemDb';
import { clearDbForWorkspace } from '../webserver/database';

vi.mock('../webserver/migration', () => ({
  runMigrations: vi.fn().mockResolvedValue({ success: true })
}));

describe('userDatabaseService', () => {
  let userId: string;
  let workspaceId: string;
  let systemDb: any;

  beforeEach(async () => {
    userId = uuidv4();
    workspaceId = uuidv4();
    systemDb = await getSystemDb();

    await systemDb.run(`
      INSERT INTO workspaces (id, name) VALUES (?, 'Test Workspace')
    `, [workspaceId]);

    await systemDb.run(`
      INSERT INTO users (id, email, username, status, default_workspace_id, password_hash) 
      VALUES (?, ?, ?, 'active', ?, 'test_hash')
    `, [userId, `test_${userId}@example.com`, `user_${userId}`, workspaceId]);
  });

  afterEach(async () => {
    await clearDbForWorkspace(workspaceId);
    
    // Clean up filesystem safely
    const userDbDir = path.join(dbDir, 'users', userId, 'databases');
    if (fs.existsSync(userDbDir)) {
      try {
        fs.rmSync(userDbDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore EPERM on Windows for test cleanup
        console.warn('Could not remove userDbDir during test cleanup', e);
      }
    }

    await systemDb.run('DELETE FROM user_databases WHERE user_id = ?', [userId]);
    await systemDb.run('DELETE FROM users WHERE id = ?', [userId]);
    await systemDb.run('DELETE FROM workspaces WHERE id = ?', [workspaceId]);
  });

  it('provisions a default database automatically', async () => {
    const result = await ensureDefaultUserDatabase(userId);
    expect(result.validDbCount).toBe(1);
    expect(result.databaseSelectionRequired).toBe(false);
    expect(result.defaultDb).toBeDefined();
    expect(result.defaultDb?.status).toBe(DbStatus.READY);
    expect(result.defaultDb?.isDefault).toBe(true);

    const dbPath = path.join(dbDir, 'users', userId, 'databases', result.defaultDb!.name);
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('marks database as missing when physical file is deleted', async () => {
    const result1 = await ensureDefaultUserDatabase(userId);
    const dbPath = path.join(dbDir, 'users', userId, 'databases', result1.defaultDb!.name);
    
    // Close connection so we can unlink the file on Windows
    await clearDbForWorkspace(workspaceId);

    // Delete file to simulate missing file
    fs.unlinkSync(dbPath);

    const dbs = await resolveUserDatabases(userId);
    expect(dbs.length).toBe(1);
    expect(dbs[0].status).toBe(DbStatus.MISSING);
  });

  it('creates multiple databases and requires selection', async () => {
    await ensureDefaultUserDatabase(userId);
    await createUserDatabase(userId, 'second_db.sqlite');

    const result = await ensureDefaultUserDatabase(userId);
    expect(result.validDbCount).toBe(2);
    expect(result.databaseSelectionRequired).toBe(true);
  });

  it('returns valid metadata for resolveUserDatabases', async () => {
    await ensureDefaultUserDatabase(userId);
    const dbs = await resolveUserDatabases(userId);
    
    expect(dbs.length).toBe(1);
    expect(dbs[0]).not.toHaveProperty('database_path');
    expect(dbs[0].name).toBeDefined();
    expect(dbs[0].status).toBe(DbStatus.READY);
  });

  it('rejects path traversal when creating custom database', async () => {
    await expect(createUserDatabase(userId, '../hacked.db')).rejects.toThrow('error.invalidDBName');
    await expect(createUserDatabase(userId, '/absolute/path.db')).rejects.toThrow('error.invalidDBName');
  });

  it('handles concurrent provisioning without duplicates', async () => {
    // Run 5 simultaneous ensureDefaultUserDatabase calls
    const promises = [
      ensureDefaultUserDatabase(userId),
      ensureDefaultUserDatabase(userId),
      ensureDefaultUserDatabase(userId),
      ensureDefaultUserDatabase(userId),
      ensureDefaultUserDatabase(userId),
    ];

    await Promise.all(promises);

    const dbs = await resolveUserDatabases(userId);
    expect(dbs.length).toBe(1);
  });
});
