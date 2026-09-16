import { type Express, type Request, type Response } from 'express';
import * as currenciesService from '../../shared/services/currencies';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initCurrenciesController = (app: Express) => {
  app.get('/api/currencies', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await currenciesService.getAllCurrencies(getDbForWorkspace((req as AuthRequest).user!.workspaceId), filter);
    res.json(result);
  });
  app.post('/api/currencies', requireDB, async (req: Request, res: Response) => {
    const result = await currenciesService.addCurrency(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
  app.put('/api/currencies', requireDB, async (req: Request, res: Response) => {
    const result = await currenciesService.updateCurrency(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
  app.delete('/api/currencies/:id', requireDB, async (req: Request, res: Response) => {
    const result = await currenciesService.deleteCurrency(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
  app.post('/api/currencies/batch', requireDB, async (req: Request, res: Response) => {
    const result = await currenciesService.batchAddCurrency(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
