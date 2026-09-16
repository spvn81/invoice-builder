const fs = require('fs');
const path = require('path');

const dir = 'G:/invoice-builder/src/backend/webserver/controllers';
const files = fs.readdirSync(dir).filter(f => !['auth.ts', 'database.ts', 'index.ts'].includes(f));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace import
  content = content.replace(/import \{ dbInstance \} from '\.\.\/database';/, `import { getDbForWorkspace } from '../database';\nimport { type AuthRequest } from '../middlewares/authMiddleware';`);

  // Replace dbInstance! with getDbForWorkspace((req as AuthRequest).user!.workspaceId)
  content = content.replace(/dbInstance!/g, `getDbForWorkspace((req as AuthRequest).user!.workspaceId)`);
  
  fs.writeFileSync(filePath, content);
}
console.log('Done refactoring');
