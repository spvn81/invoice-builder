import { type Express, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import { getSystemDb } from '../../shared/db/systemDb';
import { APP_CONFIG } from '../config';
import { sendEmail } from '../services/emailService';
import { authMiddleware, type AuthRequest } from '../middlewares/authMiddleware';
import { setupDB } from '../database';
import { DatabaseType } from '../../shared/enums/databaseType';

const generateUsername = async (db: any) => {
  let unique = false;
  let username = '';
  while (!unique) {
    const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    username = `user_${randomStr}`;
    const res = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (!res.rows || res.rows.length === 0) unique = true;
  }
  return username;
};

export const initAuthController = (app: Express) => {
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, passwordConfirmation } = req.body;
      if (!email || !password || !passwordConfirmation) {
        res.status(400).json({ success: false, message: 'error.missingCredentials' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ success: false, message: 'error.passwordTooShort' });
        return;
      }
      if (password !== passwordConfirmation) {
        res.status(400).json({ success: false, message: 'error.passwordMismatch' });
        return;
      }

      const db = await getSystemDb();

      // Check if email exists
      const existingUser = await db.query('SELECT id, status FROM users WHERE email = ?', [email]);
      if (existingUser.rows && existingUser.rows.length > 0) {
        res.status(409).json({ success: false, message: 'error.userAlreadyExists' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userId = uuidv4();
      
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = await bcrypt.hash(token, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await db.run('BEGIN');
      try {
        await db.run(
          `INSERT INTO users (id, email, password_hash, email_verified, status, verification_token_hash, verification_token_expires_at) 
           VALUES (?, ?, ?, 0, 'pending', ?, ?)`,
          [userId, email, passwordHash, tokenHash, expiresAt]
        );
        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }

      // Send Email
      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const verifyLink = `${appUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
      const emailHtml = `<p>Hello,</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyLink}">${verifyLink}</a></p>`;
      
      try {
        await sendEmail(email, 'Verify your email - Invoice Builder', emailHtml);
      } catch (e) {
        console.error('Email send failed', e);
      }

      res.json({ success: true, message: 'Verification email sent' });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
    try {
      const { email, token } = req.body;
      if (!email || !token) {
        res.status(400).json({ success: false, message: 'error.missingCredentials' });
        return;
      }

      const db = await getSystemDb();
      const userRes = await db.query('SELECT * FROM users WHERE email = ? AND status = "pending"', [email]);
      if (!userRes.rows || userRes.rows.length === 0) {
        res.status(400).json({ success: false, message: 'error.invalidOrAlreadyVerified' });
        return;
      }

      const user = userRes.rows[0];
      const now = new Date();
      if (!user.verification_token_expires_at || new Date(user.verification_token_expires_at) < now) {
        res.status(400).json({ success: false, message: 'error.tokenExpired' });
        return;
      }

      const match = await bcrypt.compare(token, user.verification_token_hash);
      if (!match) {
        res.status(400).json({ success: false, message: 'error.invalidToken' });
        return;
      }

      // Verification successful!
      const username = await generateUsername(db);
      const workspaceId = uuidv4();
      const dbId = uuidv4();
      const dbDir = path.resolve(process.cwd(), process.env.DB_DIRECTORY || APP_CONFIG?.DB_DIRECTORY || 'data', 'users', user.id, 'databases');
      const dbPath = path.resolve(dbDir, `${username}.db`);

      await db.run('BEGIN');
      try {
        await db.run('INSERT INTO workspaces (id, name) VALUES (?, ?)', [workspaceId, 'Default Workspace']);
        await db.run('UPDATE users SET username = ?, default_workspace_id = ?, email_verified = 1, status = "active", verification_token_hash = NULL WHERE id = ?', [
          username, workspaceId, user.id
        ]);
        await db.run(`INSERT INTO user_databases (id, user_id, workspace_id, database_name, database_path, database_type, is_default) VALUES (?, ?, ?, ?, ?, ?, 1)`, [
          dbId, user.id, workspaceId, `${username}.db`, dbPath, DatabaseType.sqlite
        ]);
        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }

      // Initialize the database!
      try {
        await setupDB({
          workspaceId,
          dbType: DatabaseType.sqlite,
          createIfMissing: true,
          sqliteConfig: { fullPath: dbPath }
        });
      } catch (err) {
        console.error('Failed to setup local database:', err);
        // We do not fail the request because the user is already active, but they may need to retry DB creation.
        // Or we could handle rollback above, but DB file creation is separate.
      }

      res.json({ success: true, message: 'Email verified successfully', data: { username } });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
         res.status(400).json({ success: false, message: 'error.missingCredentials' });
         return;
      }

      const db = await getSystemDb();
      const userRes = await db.query('SELECT * FROM users WHERE email = ? AND status = "pending"', [email]);
      if (!userRes.rows || userRes.rows.length === 0) {
        // Return success even if invalid to prevent email enumeration
        res.json({ success: true, message: 'Verification email sent' });
        return;
      }
      
      const user = userRes.rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = await bcrypt.hash(token, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await db.run('UPDATE users SET verification_token_hash = ?, verification_token_expires_at = ? WHERE id = ?', [tokenHash, expiresAt, user.id]);

      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const verifyLink = `${appUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
      const emailHtml = `<p>Hello,</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyLink}">${verifyLink}</a></p>`;
      
      try {
        await sendEmail(email, 'Verify your email - Invoice Builder', emailHtml);
      } catch (e) {
        console.error('Email send failed', e);
      }

      res.json({ success: true, message: 'Verification email sent' });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, message: 'error.missingCredentials' });
        return;
      }

      const db = await getSystemDb();
      const userRes = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      if (!userRes.rows || userRes.rows.length === 0) {
        res.status(401).json({ success: false, message: 'error.invalidCredentials' });
        return;
      }

      const user = userRes.rows[0];
      if (user.status !== 'active') {
        res.status(401).json({ success: false, message: 'error.accountNotActive' });
        return;
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        res.status(401).json({ success: false, message: 'error.invalidCredentials' });
        return;
      }

      // Initialize the default database into the runtime Map if sqlite
      const dbRes = await db.query('SELECT * FROM user_databases WHERE user_id = ? AND is_default = 1', [user.id]);
      if (dbRes.rows && dbRes.rows.length > 0) {
         const defaultDb = dbRes.rows[0];
         if (defaultDb.database_type === DatabaseType.sqlite) {
           await setupDB({
             workspaceId: user.default_workspace_id,
             dbType: DatabaseType.sqlite,
             createIfMissing: false,
             sqliteConfig: { fullPath: defaultDb.database_path }
           });
         }
      }

      const token = jwt.sign(
        { userId: user.id, workspaceId: user.default_workspace_id, username: user.username, email: user.email },
        process.env.JWT_SECRET || APP_CONFIG.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({ success: true, data: { userId: user.id, username: user.username, email: user.email, workspaceId: user.default_workspace_id } });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const db = await getSystemDb();
      const userRes = await db.query('SELECT id, email, username, email_verified, status, default_workspace_id FROM users WHERE id = ?', [req.user?.userId]);
      if (!userRes.rows || userRes.rows.length === 0) {
        res.status(401).json({ success: false, message: 'error.invalidSession' });
        return;
      }
      const user = userRes.rows[0];
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.email_verified === 1,
          status: user.status,
          workspaceId: user.default_workspace_id
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    res.clearCookie('token');
    // We should ideally call clearDbForWorkspace here, but we need the token to know which workspace to clear.
    // However, clearing cookie is sufficient for client, and the DB connection map can stay cached or we decode token here.
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || APP_CONFIG.JWT_SECRET) as any;
        const { clearDbForWorkspace } = await import('../database');
        await clearDbForWorkspace(decoded.workspaceId);
      } catch (e) {
        // ignore
      }
    }
    res.json({ success: true });
  });
};
