import type { NextFunction } from 'express';
import { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { FilterType } from '../../shared/enums/filterType';
import type { FilterData } from '../../shared/types/invoiceFilter';
// Removed dbInstance import

export const parseFilter = (query: string | undefined): FilterData[] | undefined => {
  if (!query) return undefined;

  let parsed: unknown;

  try {
    parsed = JSON.parse(query);
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed)) return undefined;

  const result: FilterData[] = [];

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;

    const { type, value } = item;

    if (!Object.values(FilterType).includes(type)) continue;

    if (typeof value !== 'string') continue;

    result.push({ type, value });
  }

  return result.length ? result : undefined;
};

import { getDbForWorkspace } from '../database';
import { type AuthRequest } from '../middlewares/authMiddleware';

export const requireDB = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user || !authReq.user.workspaceId) {
    return res.status(401).json({
      success: false,
      message: undefined,
      key: 'error.unauthenticated'
    });
  }

  try {
    // This will throw if the database isn't initialized for the workspace
    getDbForWorkspace(authReq.user.workspaceId);
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: undefined,
      key: 'error.databaseNotInitialized'
    });
  }
};

export const listDbLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: undefined,
    key: 'error.rateLimiter'
  }
});
