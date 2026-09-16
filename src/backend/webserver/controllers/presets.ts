import { type Express, type Request, type Response as ResponseExpress } from 'express';
import * as presetsService from '../../shared/services/presets';
import { decodePreset, encodeResultPreset } from '../../shared/utils/dataUrlFunctions';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initPresetsController = (app: Express) => {
  app.get('/api/presets', requireDB, async (req: Request, res: ResponseExpress) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await presetsService.getAllPresets(getDbForWorkspace((req as AuthRequest).user!.workspaceId), filter);
    res.json(encodeResultPreset(result));
  });
  app.post('/api/presets', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await presetsService.addPreset(getDbForWorkspace((req as AuthRequest).user!.workspaceId), decodePreset(req.body));
    res.json(encodeResultPreset(result));
  });
  app.put('/api/presets', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await presetsService.updatePreset(getDbForWorkspace((req as AuthRequest).user!.workspaceId), decodePreset(req.body));
    res.json(encodeResultPreset(result));
  });
  app.delete('/api/presets/:id', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await presetsService.deletePreset(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
  app.post('/api/presets/batch', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await presetsService.batchAddPreset(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
