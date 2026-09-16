import { type Express, type Request, type Response } from 'express';
import fsPromise from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { testPostgresConnection, testMySqlConnection } from '../../shared/db/setup';
import { DatabaseType } from '../../shared/enums/databaseType';
import { listDbLimiter } from '../utils/functions';
import { authMiddleware, type AuthRequest } from '../middlewares/authMiddleware';
import { getSystemDb } from '../../shared/db/systemDb';
import { v4 as uuidv4 } from 'uuid';
import { 
  dbDir, 
  getUserDbDir, 
  resolveUserDatabases, 
  createUserDatabase, 
  openUserDatabase,
  deleteUserDatabase,
  DbStatus
} from '../../shared/services/userDatabaseService';
import { setupDB } from '../database';

export const initDatabaseController = (app: Express) => {
  app.get('/api/databases', listDbLimiter, authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;
      const databases = await resolveUserDatabases(userId);
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

  app.post('/api/databases/select', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;
      const { databaseId } = req.body;
      if (!databaseId) {
        return res.status(400).json({ success: false, message: 'error.missingDatabaseId' });
      }

      await openUserDatabase(userId, databaseId);

      res.json({ success: true, message: 'Database selected successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/databases/create', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;
      const name = String(req.body?.name ?? req.body?.fullPath ?? '');
      
      if (!name) {
         return res.status(400).json({ success: false, message: 'error.missingDatabaseName' });
      }

      const newDb = await createUserDatabase(userId, name);
      
      res.json({ success: true, data: newDb });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
  
  app.delete('/api/databases/:databaseId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;
      const { databaseId } = req.params;
      
      if (!databaseId) {
         return res.status(400).json({ success: false, message: 'error.missingDatabaseId' });
      }
      
      await deleteUserDatabase(userId, databaseId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
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
      
      try {
        await setupDB({
          workspaceId,
          dbType: DatabaseType.sqlite,
          createIfMissing: false,
          sqliteConfig: { fullPath: targetPath }
        });
      } catch (err) {
        await fsPromise.unlink(targetPath);
        res.status(400).json({ success: false, message: 'error.invalidLegacyDb' });
        return;
      }
      
      const systemDb = await getSystemDb();
      const dbId = uuidv4();
      
      await systemDb.run(`INSERT INTO user_databases (id, user_id, workspace_id, database_name, database_path, database_type, is_default, status) VALUES (?, ?, ?, ?, ?, ?, 0, 'ready')`, [
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
      // Compatibility fallback for old frontend versions that call POST /api/databases 
      // when they actually want to create a sqlite DB by string name.
      const name = String(req.body?.fullPath ?? '');
      if (name.includes('..') || path.isAbsolute(name) || name.includes('/') || name.includes('\\')) {
        res.status(400).json({ success: false, message: 'error.invalidDBName' });
        return;
      }
      const userId = (req as AuthRequest).user!.userId;
      await createUserDatabase(userId, name);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
};
