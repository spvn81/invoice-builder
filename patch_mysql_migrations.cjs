const fs = require('fs');

function patchFile(file, searchStr, mysqlBlock) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('db.type === DatabaseType.mysql')) return; // Already patched
  const postgreIndex = content.indexOf('if (db.type === DatabaseType.postgre)');
  if (postgreIndex === -1) return;
  
  // Find the end of the postgre block. It's tricky to parse { } properly, 
  // so we'll just search for the specific closing brace if we provide a search string.
  const newContent = content.replace(searchStr, searchStr + '\n\n' + mysqlBlock);
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('Patched ' + file);
}

patchFile(
  'src/backend/shared/migrations/20260105-01-invoice_items-quantity-to-text.ts',
  '    }',
  `    if (db.type === DatabaseType.mysql) {\n      try { await db.run(\`ALTER TABLE invoice_items MODIFY COLUMN "quantity" VARCHAR(255);\`); } catch(e) {}\n    }`
);

// 20260108-02
const p20260108 = `    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoices RENAME COLUMN "invoicePrefixSnapshot" TO "invoicePrefix";\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices RENAME COLUMN "invoiceSuffixSnapshot" TO "invoiceSuffix";\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD COLUMN "language" VARCHAR(255) NOT NULL DEFAULT 'en';\`); } catch(e) {}
      try { await db.run(\`
        ALTER TABLE invoices
        ADD COLUMN "invoiceFullNumber" VARCHAR(255) GENERATED ALWAYS AS (
          CONCAT(COALESCE(\\\`invoicePrefix\\\`, ''), \\\`invoiceNumber\\\`, COALESCE(\\\`invoiceSuffix\\\`, ''))
        ) STORED;
      \`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices DROP INDEX invoices_businessId_invoiceNumber_key;\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD UNIQUE INDEX invoices_businessId_invoiceFullNumber_key ("businessId", "invoiceFullNumber");\`); } catch(e) {}
    }`;
let c = fs.readFileSync('src/backend/shared/migrations/20260108-02-invoices-prefix-suffix-language.ts', 'utf8');
if (!c.includes('DatabaseType.mysql')) {
  c = c.replace(/UNIQUE \("businessId", "invoiceFullNumber"\);\n\s+`\);\n    }/g, 'UNIQUE ("businessId", "invoiceFullNumber");\n      `);\n    }\n' + p20260108);
  fs.writeFileSync('src/backend/shared/migrations/20260108-02-invoices-prefix-suffix-language.ts', c);
}

// 20260205-09
const p20260205 = `    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoice_item_snaphots RENAME TO invoice_item_snapshots;\`); } catch(e) {}
    }`;
c = fs.readFileSync('src/backend/shared/migrations/20260205-09-invoice_item_snapshots_fix-name.ts', 'utf8');
if (!c.includes('DatabaseType.mysql')) {
  c = c.replace(/RENAME TO invoice_item_snapshots_pkey;`\);\n    }/g, 'RENAME TO invoice_item_snapshots_pkey;`);\n    }\n' + p20260205);
  fs.writeFileSync('src/backend/shared/migrations/20260205-09-invoice_item_snapshots_fix-name.ts', c);
}

// 20260206-10
const p20260206 = `    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoices MODIFY COLUMN "discountAmountCents" VARCHAR(255);\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices MODIFY COLUMN "shippingFeeCents" VARCHAR(255);\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoice_payments MODIFY COLUMN "amountCents" VARCHAR(255);\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoice_item_snapshots MODIFY COLUMN "unitPriceCents" VARCHAR(255);\`); } catch(e) {}
    }`;
c = fs.readFileSync('src/backend/shared/migrations/20260206-10-converting-amount-fields.ts', 'utf8');
if (!c.includes('DatabaseType.mysql')) {
  c = c.replace(/\);\n      `\);\n    }/g, ');\n      `);\n    }\n' + p20260206);
  fs.writeFileSync('src/backend/shared/migrations/20260206-10-converting-amount-fields.ts', c);
}

// 20260209-11
const p20260209_11 = `    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`
        UPDATE invoice_items
        SET "customField" = JSON_SET(COALESCE("customField", '{}'), '$.sortOrder', 0)
        WHERE "customField" IS NULL OR JSON_EXTRACT("customField", '$.sortOrder') IS NULL;
      \`); } catch(e) {}
    }`;
c = fs.readFileSync('src/backend/shared/migrations/20260209-11-custom-fields-order.ts', 'utf8');
if (!c.includes('DatabaseType.mysql')) {
  c = c.replace(/WHERE "customField"->>'sortOrder' IS NULL;\n      `\);\n    }/g, 'WHERE "customField"->>\'sortOrder\' IS NULL;\n      `);\n    }\n' + p20260209_11);
  fs.writeFileSync('src/backend/shared/migrations/20260209-11-custom-fields-order.ts', c);
}

// 20260209-12
const p20260209_12 = `    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoices ADD COLUMN "bankId" INTEGER;\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD CONSTRAINT invoices_bankId_fkey FOREIGN KEY ("bankId") REFERENCES banks("id");\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD CONSTRAINT invoices_styleProfilesId_fkey FOREIGN KEY ("styleProfilesId") REFERENCES style_profiles("id");\`); } catch(e) {}
      try { await db.run(\`CREATE INDEX IF NOT EXISTS idx_invoices_styleProfilesId ON invoices("styleProfilesId")\`); } catch(e) {}
      try { await db.run(\`CREATE INDEX IF NOT EXISTS idx_invoices_bankId ON invoices("bankId")\`); } catch(e) {}
    }`;
c = fs.readFileSync('src/backend/shared/migrations/20260209-12-banks-table.ts', 'utf8');
if (!c.includes('DatabaseType.mysql')) {
  c = c.replace(/CREATE INDEX IF NOT EXISTS idx_invoices_bankId ON invoices\("bankId"\)`\);\n    }/g, 'CREATE INDEX IF NOT EXISTS idx_invoices_bankId ON invoices("bankId")`);\n    }\n' + p20260209_12);
  fs.writeFileSync('src/backend/shared/migrations/20260209-12-banks-table.ts', c);
}

// 20260810-22
const p20260810 = `    if (db.type === DatabaseType.mysql) {
      try { await db.run('ALTER TABLE invoices DROP INDEX invoices_businessId_invoiceFullNumber_key'); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD UNIQUE INDEX invoices_businessId_invoiceFullNumber_clientId_key ("businessId", "invoiceFullNumber", "clientId")\`); } catch(e) {}
      return;
    }`;
c = fs.readFileSync('src/backend/shared/migrations/20260810-22-invoice-unique.ts', 'utf8');
if (!c.includes('DatabaseType.mysql')) {
  c = c.replace(/UNIQUE \("businessId", "invoiceFullNumber", "clientId"\)`\n      \);\n      return;\n    }/g, 'UNIQUE ("businessId", "invoiceFullNumber", "clientId")`\n      );\n      return;\n    }\n' + p20260810);
  fs.writeFileSync('src/backend/shared/migrations/20260810-22-invoice-unique.ts', c);
}

// 20260826-24
const p20260826_24 = `    if (db.type === DatabaseType.mysql) {
      try { await db.run('ALTER TABLE invoices DROP INDEX invoices_businessId_invoiceFullNumber_clientId_key'); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD UNIQUE INDEX invoices_businessId_invoiceFullNumber_clientId_invoiceType_key ("businessId", "invoiceFullNumber", "clientId", "invoiceType")\`); } catch(e) {}
      return;
    }`;
c = fs.readFileSync('src/backend/shared/migrations/20260826-24-invoice-unique.ts', 'utf8');
if (!c.includes('DatabaseType.mysql')) {
  c = c.replace(/UNIQUE \("businessId", "invoiceFullNumber", "clientId", "invoiceType"\)`\n      \);\n      return;\n    }/g, 'UNIQUE ("businessId", "invoiceFullNumber", "clientId", "invoiceType")`\n      );\n      return;\n    }\n' + p20260826_24);
  fs.writeFileSync('src/backend/shared/migrations/20260826-24-invoice-unique.ts', c);
}

// 20260826-25
const p20260826_25 = `    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoice_sequences ADD COLUMN "invoiceType" VARCHAR(255) NOT NULL DEFAULT 'invoice'\`); } catch(e) {}
      try { await db.run('ALTER TABLE invoice_sequences DROP INDEX invoice_sequences_businessId_clientId_key'); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoice_sequences ADD UNIQUE INDEX invoice_sequences_business_client_type_unique ("businessId", "clientId", "invoiceType")\`); } catch(e) {}
      return;
    }`;
c = fs.readFileSync('src/backend/shared/migrations/20260826-25-invoice-sequence.ts', 'utf8');
if (!c.includes('DatabaseType.mysql')) {
  c = c.replace(/UNIQUE \("businessId", "clientId", "invoiceType"\)`\n      \);\n      return;\n    }/g, 'UNIQUE ("businessId", "clientId", "invoiceType")`\n      );\n      return;\n    }\n' + p20260826_25);
  fs.writeFileSync('src/backend/shared/migrations/20260826-25-invoice-sequence.ts', c);
}

console.log("Done");
