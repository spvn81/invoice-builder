import { type Express, type Request, type Response } from 'express';
import * as settingsService from '../../shared/services/settings';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { requireDB } from '../utils/functions';

export const initSettingsController = (app: Express) => {
  app.get('/api/settings', requireDB, async (req: Request, res: Response) => {
    const result = await settingsService.getAllSettings(getDbForWorkspace((req as AuthRequest).user!.workspaceId));
    res.json(result);
  });
  app.put('/api/settings', requireDB, async (req: Request, res: Response) => {
    const result = await settingsService.updateSettings(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
