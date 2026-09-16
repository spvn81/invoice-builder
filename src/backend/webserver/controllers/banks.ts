import { type Express, type Request, type Response } from 'express';
import * as banksService from '../../shared/services/banks';
import { decodeBank, encodeResultBank } from '../../shared/utils/dataUrlFunctions';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initBanksController = (app: Express) => {
  app.get('/api/banks', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await banksService.getAllBanks(getDbForWorkspace((req as AuthRequest).user!.workspaceId), filter);
    res.json(encodeResultBank(result));
  });
  app.post('/api/banks', requireDB, async (req: Request, res: Response) => {
    const result = await banksService.addBank(getDbForWorkspace((req as AuthRequest).user!.workspaceId), decodeBank(req.body));
    res.json(encodeResultBank(result));
  });
  app.put('/api/banks', requireDB, async (req: Request, res: Response) => {
    const result = await banksService.updateBank(getDbForWorkspace((req as AuthRequest).user!.workspaceId), decodeBank(req.body));
    res.json(encodeResultBank(result));
  });
  app.delete('/api/banks/:id', requireDB, async (req: Request, res: Response) => {
    const result = await banksService.deleteBank(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
  app.post('/api/banks/batch', requireDB, async (req: Request, res: Response) => {
    const result = await banksService.batchAddBank(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
