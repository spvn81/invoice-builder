import 'dotenv/config';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { APP_CONFIG } from './config';
import { initControllers } from './controllers';
import { initDatabaseController } from './controllers/database';
import { initAuthController } from './controllers/auth';

const port = Number(process.env.PORT) || Number(APP_CONFIG.PORT);
const server = process.env.DEV_SERVER_URL || APP_CONFIG.DEV_SERVER_URL;
const feServer = process.env.FE_SERVER_URL || APP_CONFIG.FE_SERVER_URL;
const host = process.env.NODE_ENV === 'docker' ? 'localhost' : server;
const version = APP_CONFIG.VERSION;

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: feServer,
    credentials: true
  })
);
app.set('trust proxy', 1);

const main = async () => {
  initAuthController(app);
  initDatabaseController(app);
  initControllers(app);

  if (process.env.DATABASE_TYPE === 'mysql') {
    const { setupDB } = await import('./database');
    const { DatabaseType } = await import('../shared/enums/databaseType');
    await setupDB({
      dbType: DatabaseType.mysql,
      mysqlConfig: {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'invoice_builder',
        ssl: process.env.MYSQL_SSL === 'true'
      }
    });
    console.log('Connected to MySQL via environment variables.');
  }

  app.listen(port, server, () => {
    console.log(`Server listening at http://${host}:${port}`);
  });
  // app.get('*', (_req: Request, res: Response) => {
  //   res.sendFile(path.join(distPath, 'index.html'));
  // });
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.get('/api/version', (_req: Request, res: Response) => {
    res.json({ version: version });
  });
};

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
