import { type Express, type Request, type Response as ResponseExpress } from 'express';
import * as styleProfilesService from '../../shared/services/styleProfiles';
import { decodeStyleProfile, encodeResultStyleProfile } from '../../shared/utils/dataUrlFunctions';
import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';
import { parseFilter, requireDB } from '../utils/functions';

export const initStyleProfilesController = (app: Express) => {
  app.get('/api/styleProfiles', requireDB, async (req: Request, res: ResponseExpress) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await styleProfilesService.getAllStyleProfiles(getDbForWorkspace((req as AuthRequest).user!.workspaceId), filter);
    res.json(encodeResultStyleProfile(result));
  });
  app.post('/api/styleProfiles', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await styleProfilesService.addStyleProfile(getDbForWorkspace((req as AuthRequest).user!.workspaceId), decodeStyleProfile(req.body));
    res.json(encodeResultStyleProfile(result));
  });
  app.put('/api/styleProfiles', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await styleProfilesService.updateStyleProfile(getDbForWorkspace((req as AuthRequest).user!.workspaceId), decodeStyleProfile(req.body));
    res.json(encodeResultStyleProfile(result));
  });
  app.delete('/api/styleProfiles/:id', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await styleProfilesService.deleteStyleProfile(getDbForWorkspace((req as AuthRequest).user!.workspaceId), Number(req.params.id));
    res.json(result);
  });
  app.post('/api/styleProfiles/batch', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await styleProfilesService.batchAddStyleProfile(getDbForWorkspace((req as AuthRequest).user!.workspaceId), req.body);
    res.json(result);
  });
};
