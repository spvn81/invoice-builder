import { type Express, type Request, type Response } from 'express';
import * as service from '../../shared/services/layouts';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initLayoutsController = (app: Express) => {
  app.get('/api/layouts', requireDB, async (req: Request, res: Response) =>
    res.json(await service.getAllLayouts(getDbForWorkspace((req as AuthRequest).user!.workspaceId), parseFilter(req.query.filter as string)))
  );
  app.post('/api/layouts', requireDB, async (req: Request, res: Response) =>
    res.json(await service.addLayout(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body))
  );
  app.put('/api/layouts', requireDB, async (req: Request, res: Response) =>
    res.json(await service.updateLayout(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body))
  );
  app.delete('/api/layouts/:id', requireDB, async (req: Request, res: Response) =>
    res.json(await service.deleteLayout(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id)))
  );
  app.get('/api/layouts/export/:id', requireDB, async (req: Request, res: Response) => {
    const result = await service.exportLayout(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
};
