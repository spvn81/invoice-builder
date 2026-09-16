const fs = require('fs');
const cols = new Set();
function processFile(file) {
  const c = fs.readFileSync(file, 'utf8');
  const m = c.matchAll(/CREATE INDEX.*?ON.*?\(\"([^\"]+)\"\)/gi);
  for (const match of m) {
    cols.add(match[1]);
  }
}
processFile('src/backend/shared/db/setup.ts');
const files = fs.readdirSync('src/backend/shared/migrations');
files.forEach(f => processFile('src/backend/shared/migrations/' + f));
console.log(Array.from(cols).join(', '));
