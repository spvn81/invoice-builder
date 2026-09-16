const fs = require('fs');

function patch(file, mysqlBlock) {
  let c = fs.readFileSync(file, 'utf8');
  if (c.includes('DatabaseType.mysql')) return; // skip if patched

  // insert before the final } catch (error) block
  c = c.replace(/  } catch \(error\)/, mysqlBlock + '\n  } catch (error)');
  fs.writeFileSync(file, c);
  console.log('Patched ' + file);
}

// For 20260205-09
patch('src/backend/shared/migrations/20260205-09-invoice_item_snapshots_fix-name.ts', `
    if (db.type === DatabaseType.postgre) return;
    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoice_item_snaphots RENAME TO invoice_item_snapshots;\`); } catch(e) {}
      return;
    }
`);

// For 20260206-10
patch('src/backend/shared/migrations/20260206-10-converting-amount-fields.ts', `
    if (db.type === DatabaseType.postgre) return;
    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoices MODIFY COLUMN "discountAmountCents" VARCHAR(255);\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices MODIFY COLUMN "shippingFeeCents" VARCHAR(255);\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoice_payments MODIFY COLUMN "amountCents" VARCHAR(255);\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoice_item_snapshots MODIFY COLUMN "unitPriceCents" VARCHAR(255);\`); } catch(e) {}
      return;
    }
`);

// For 20260209-12
patch('src/backend/shared/migrations/20260209-12-banks-table.ts', `
    if (db.type === DatabaseType.postgre) return;
    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoices ADD COLUMN "bankId" INTEGER;\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD CONSTRAINT invoices_bankId_fkey FOREIGN KEY ("bankId") REFERENCES banks("id");\`); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD CONSTRAINT invoices_styleProfilesId_fkey FOREIGN KEY ("styleProfilesId") REFERENCES style_profiles("id");\`); } catch(e) {}
      try { await db.run(\`CREATE INDEX IF NOT EXISTS idx_invoices_styleProfilesId ON invoices("styleProfilesId")\`); } catch(e) {}
      try { await db.run(\`CREATE INDEX IF NOT EXISTS idx_invoices_bankId ON invoices("bankId")\`); } catch(e) {}
      return;
    }
`);

// For 20260810-22
patch('src/backend/shared/migrations/20260810-22-invoice-unique.ts', `
    if (db.type === DatabaseType.postgre) return;
    if (db.type === DatabaseType.mysql) {
      try { await db.run('ALTER TABLE invoices DROP INDEX invoices_businessId_invoiceFullNumber_key'); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD UNIQUE INDEX invoices_businessId_invoiceFullNumber_clientId_key ("businessId", "invoiceFullNumber", "clientId")\`); } catch(e) {}
      return;
    }
`);

// For 20260826-24
patch('src/backend/shared/migrations/20260826-24-invoice-unique.ts', `
    if (db.type === DatabaseType.postgre) return;
    if (db.type === DatabaseType.mysql) {
      try { await db.run('ALTER TABLE invoices DROP INDEX invoices_businessId_invoiceFullNumber_clientId_key'); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoices ADD UNIQUE INDEX invoices_businessId_invoiceFullNumber_clientId_invoiceType_key ("businessId", "invoiceFullNumber", "clientId", "invoiceType")\`); } catch(e) {}
      return;
    }
`);

// For 20260826-25
patch('src/backend/shared/migrations/20260826-25-invoice-sequence.ts', `
    if (db.type === DatabaseType.postgre) return;
    if (db.type === DatabaseType.mysql) {
      try { await db.run(\`ALTER TABLE invoice_sequences ADD COLUMN "invoiceType" VARCHAR(255) NOT NULL DEFAULT 'invoice'\`); } catch(e) {}
      try { await db.run('ALTER TABLE invoice_sequences DROP INDEX invoice_sequences_businessId_clientId_key'); } catch(e) {}
      try { await db.run(\`ALTER TABLE invoice_sequences ADD UNIQUE INDEX invoice_sequences_business_client_type_unique ("businessId", "clientId", "invoiceType")\`); } catch(e) {}
      return;
    }
`);

console.log('Done2');
