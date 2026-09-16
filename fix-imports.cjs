const fs = require('fs');
const path = require('path');

const files = [
  'businesses.ts',
  'categories.ts',
  'clients.ts',
  'currencies.ts',
  'invoices.ts',
  'items.ts',
  'layouts.ts',
  'presets.ts',
  'styleProfiles.ts',
  'units.ts'
];

files.forEach(f => {
  const p = path.join(__dirname, 'src/backend/shared/services', f);
  if (!fs.existsSync(p)) return;
  
  let c = fs.readFileSync(p, 'utf8');
  
  c = c.replace(/import \{([^}]+)\} from '\.\.\/utils\/entitiesFunctions';/g, (match, p1) => {
    if (p1.includes('deleteEntity')) return match;
    return `import { ${p1.trim()}, deleteEntity } from '../utils/entitiesFunctions';`;
  });
  
  c = c.replace(/deleteUnit\(/g, 'deleteEntity(');
  
  fs.writeFileSync(p, c);
  console.log('Fixed', f);
});
