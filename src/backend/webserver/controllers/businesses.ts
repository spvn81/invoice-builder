import { type Express, type Request, type Response as ResponseExpress } from 'express';
import * as businessesService from '../../shared/services/businesses';
import { decodeLogo, encodeResultBusiness } from '../../shared/utils/dataUrlFunctions';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initBusinessesController = (app: Express) => {
  app.get('/api/businesses', requireDB, async (req: Request, res: ResponseExpress) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await businessesService.getAllBusinesses(getDbForWorkspace((req as AuthRequest).user!.workspaceId), filter);
    res.json(encodeResultBusiness(result));
  });
  app.post('/api/businesses', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await businessesService.addBusiness(getDbForWorkspace((req as AuthRequest).user!.workspaceId), decodeLogo(req.body));
    res.json(encodeResultBusiness(result));
  });
  app.put('/api/businesses', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await businessesService.updateBusiness(getDbForWorkspace((req as AuthRequest).user!.workspaceId), decodeLogo(req.body));
    res.json(encodeResultBusiness(result));
  });
  app.delete('/api/businesses/:id', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await businessesService.deleteBusiness(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
  app.post('/api/businesses/batch', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await businessesService.batchAddBusiness(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
