import { type Express, type Request, type Response } from 'express';
import * as unitsService from '../../shared/services/units';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initUnitsController = (app: Express) => {
  app.get('/api/units', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await unitsService.getAllUnits(getDbForWorkspace((req as AuthRequest).user!.workspaceId), filter);
    res.json(result);
  });
  app.post('/api/units', requireDB, async (req: Request, res: Response) => {
    const result = await unitsService.addUnit(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
  app.put('/api/units', requireDB, async (req: Request, res: Response) => {
    const result = await unitsService.updateUnit(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
  app.delete('/api/units/:id', requireDB, async (req: Request, res: Response) => {
    const result = await unitsService.deleteUnit(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
  app.post('/api/units/batch', requireDB, async (req: Request, res: Response) => {
    const result = await unitsService.batchAddUnit(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
