import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { APP_CONFIG } from '../config';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    workspaceId: string;
    username: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ success: false, message: 'error.unauthenticated' });
    return;
  }

  try {
    const decoded = jwt.verify(token, APP_CONFIG.JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId,
      workspaceId: decoded.workspaceId,
      username: decoded.username
    };
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'error.invalidToken' });
  }
};
