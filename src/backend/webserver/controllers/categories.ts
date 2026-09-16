import { type Express, type Request, type Response } from 'express';
import * as categoriesService from '../../shared/services/categories';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initCategoriesController = (app: Express) => {
  app.get('/api/categories', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await categoriesService.getAllCategories(getDbForWorkspace((req as AuthRequest).user!.workspaceId), filter);
    res.json(result);
  });
  app.post('/api/categories', requireDB, async (req: Request, res: Response) => {
    const result = await categoriesService.addCategory(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
  app.put('/api/categories', requireDB, async (req: Request, res: Response) => {
    const result = await categoriesService.updateCategory(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
  app.delete('/api/categories/:id', requireDB, async (req: Request, res: Response) => {
    const result = await categoriesService.deleteCategory(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
  app.post('/api/categories/batch', requireDB, async (req: Request, res: Response) => {
    const result = await categoriesService.batchAddCategory(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
