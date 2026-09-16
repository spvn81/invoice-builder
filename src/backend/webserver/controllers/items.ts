import { type Express, type Request, type Response } from 'express';
import * as itemsService from '../../shared/services/items';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initItemsController = (app: Express) => {
  app.get('/api/items', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await itemsService.getAllItems(getDbForWorkspace((req as AuthRequest).user!.workspaceId), filter);
    res.json(result);
  });
  app.post('/api/items', requireDB, async (req: Request, res: Response) => {
    const result = await itemsService.addItem(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
  app.put('/api/items', requireDB, async (req: Request, res: Response) => {
    const result = await itemsService.updateItem(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
  app.delete('/api/items/:id', requireDB, async (req: Request, res: Response) => {
    const result = await itemsService.deleteItem(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
  app.post('/api/items/batch', requireDB, async (req: Request, res: Response) => {
    const result = await itemsService.batchAddItem(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
