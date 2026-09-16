import { type Express, type Request, type Response } from 'express';
import fsPromise from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { testPostgresConnection, testMySqlConnection } from '../../shared/db/setup';
import { DatabaseType } from '../../shared/enums/databaseType';
import { DBInitType } from '../../shared/enums/dbInitType';
import { APP_CONFIG } from '../config';
import { setupDB } from '../database';
import { listDbLimiter } from '../utils/functions';
import { authMiddleware, type AuthRequest } from '../middlewares/authMiddleware';
import { getSystemDb } from '../../shared/db/systemDb';
import { v4 as uuidv4 } from 'uuid';

export const dbDir = path.resolve(process.cwd(), process.env.DB_DIRECTORY || APP_CONFIG.DB_DIRECTORY || 'data');

export const getUserDbDir = (userId: string) => {
  const dir = path.join(dbDir, 'users', userId, 'databases');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

export const initDatabaseController = (app: Express) => {
  app.get('/api/databases', listDbLimiter, authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;
      const systemDb = await getSystemDb();
      
      const dbRes = await systemDb.query('SELECT database_name, database_type, is_default FROM user_databases WHERE user_id = ?', [userId]);
      
      const databases = dbRes.rows || [];

      res.json({
        success: true,
        data: databases
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: (err as Error).message
      });
    }
  });
  
  app.get('/api/databases/legacy', authMiddleware, async (_req: Request, res: Response) => {
    try {
      if (!fs.existsSync(dbDir)) {
        return res.json({ success: true, data: [] });
      }
      const files = await fsPromise.readdir(dbDir);
      const legacyDbs = files.filter(f => (f.endsWith('.db') || f.endsWith('.sqlite')) && f !== 'system.db');
      
      res.json({ success: true, data: legacyDbs });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/databases/import-legacy', authMiddleware, async (req: Request, res: Response) => {
    try {
      const filename = String(req.body?.filename ?? '');
      if (filename.includes('..') || path.isAbsolute(filename) || filename.includes('/') || filename.includes('\\') || filename === 'system.db') {
        res.status(400).json({ success: false, message: 'error.invalidDBName' });
        return;
      }
      
      const sourcePath = path.join(dbDir, filename);
      if (!fs.existsSync(sourcePath)) {
        res.status(404).json({ success: false, message: 'error.dbNotFound' });
        return;
      }
      
      const userId = (req as AuthRequest).user!.userId;
      const workspaceId = (req as AuthRequest).user!.workspaceId;
      const userDbDir = getUserDbDir(userId);
      const targetPath = path.join(userDbDir, filename);
      
      if (fs.existsSync(targetPath)) {
         res.status(409).json({ success: false, message: 'error.dbAlreadyExists' });
         return;
      }
      
      await fsPromise.copyFile(sourcePath, targetPath);
      
      const systemDb = await getSystemDb();
      const dbId = uuidv4();
      
      await systemDb.run(`INSERT INTO user_databases (id, user_id, workspace_id, database_name, database_path, database_type, is_default) VALUES (?, ?, ?, ?, ?, ?, 0)`, [
         dbId, userId, workspaceId, filename, targetPath, DatabaseType.sqlite
      ]);
      
      res.json({ success: true, message: 'Legacy database imported successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/databases/test', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { dbType, ...config } = req.body;

      if (dbType === DatabaseType.mysql) {
        await testMySqlConnection(config);
      } else {
        if (config.host === 'localhost') {
          config.host = 'host.docker.internal';
        }
        await testPostgresConnection(config);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/databases', authMiddleware, async (req: Request, res: Response) => {
    try {
      const name = String(req.body?.fullPath ?? '');
      // Prevent path traversal
      if (name.includes('..') || path.isAbsolute(name) || name.includes('/') || name.includes('\\')) {
        res.status(400).json({ success: false, message: 'error.invalidDBName' });
        return;
      }

      const mode = String(req.body?.mode ?? '');
      const dbType = req.body?.dbType ?? DatabaseType.sqlite;
      const postgresConfig = req.body?.postgresConfig;
      const mysqlConfig = req.body?.mysqlConfig;
      
      const userId = (req as AuthRequest).user!.userId;
      const workspaceId = (req as AuthRequest).user!.workspaceId;
      const userDbDir = getUserDbDir(userId);
      const fullPath = path.join(userDbDir, name);
      
      const createIfMissing = mode === DBInitType.create || typeof mode === 'undefined';

      if (process.env.NODE_ENV === 'docker' && postgresConfig && postgresConfig.host === 'localhost') {
        postgresConfig.host = 'host.docker.internal';
      }
      if (process.env.NODE_ENV === 'docker' && mysqlConfig && mysqlConfig.host === 'localhost') {
        mysqlConfig.host = 'host.docker.internal';
      }

      // First run setup to ensure validity
      await setupDB({
        workspaceId,
        sqliteConfig: { fullPath: fullPath },
        dbType: dbType,
        createIfMissing,
        postgresConfig: postgresConfig,
        mysqlConfig: mysqlConfig
      });
      
      // Update system DB mapping if it doesn't exist
      const systemDb = await getSystemDb();
      const existing = await systemDb.query('SELECT id FROM user_databases WHERE user_id = ? AND database_name = ?', [userId, name]);
      
      if (!existing.rows || existing.rows.length === 0) {
        const dbId = uuidv4();
        // Determine is_default: if no DBs exist, make it default, else 0
        const allUserDbs = await systemDb.query('SELECT count(*) as cnt FROM user_databases WHERE user_id = ?', [userId]);
        const isDefault = allUserDbs.rows && (allUserDbs.rows[0] as any).cnt === 0 ? 1 : 0;
        
        await systemDb.run(`INSERT INTO user_databases (id, user_id, workspace_id, database_name, database_path, database_type, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
           dbId, userId, workspaceId, name, dbType === DatabaseType.sqlite ? fullPath : '', dbType, isDefault
        ]);
        
        // If they requested an active switch, we could update is_default, but for now we just insert.
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
};
