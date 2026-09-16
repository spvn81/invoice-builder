import { describe, it, expect, beforeEach } from 'vitest';
import { getInvoices, addInvoice } from '../invoices';
import { initInitialData, initSchema } from '../../db/setup';
import { runMigrations } from '../../db/migrationRunner';
import path from 'path';
import sqlite3 from 'sqlite3';
import { createSqliteAdapter } from '../../db/client';
import type { DatabaseAdapter } from '../../types/DatabaseAdapter';
import { InvoiceType } from '../../enums/invoiceType';
import { InvoiceStatus } from '../../enums/invoiceStatus';
import { Language } from '../../enums/language';

// Helper to set up a workspace DB
const createWorkspaceDb = async (workspaceId: string): Promise<DatabaseAdapter> => {
  const sqlite = new sqlite3.Database(':memory:');
  const db = createSqliteAdapter(sqlite);
  db.workspaceId = workspaceId;
  await initSchema(db);
  await runMigrations(db, path.resolve(__dirname, '../../../../../dist-be/backend/migrations'));
  await initInitialData(db);
  return db;
};

describe('Concurrent Multi-Workspace Isolation', () => {
  let dbA: DatabaseAdapter;
  let dbB: DatabaseAdapter;

  beforeEach(async () => {
    dbA = await createWorkspaceDb('workspace-a');
    dbB = await createWorkspaceDb('workspace-b');
    
    // Insert base data
    await dbA.run(`INSERT INTO businesses ("name", "shortName") VALUES (?, ?);`, ['Biz A', 'BA'], true);
    await dbB.run(`INSERT INTO businesses ("name", "shortName") VALUES (?, ?);`, ['Biz B', 'BB'], true);
    
    await dbA.run(`INSERT INTO clients ("name", "shortName") VALUES (?, ?);`, ['Client A', 'CA'], true);
    await dbB.run(`INSERT INTO clients ("name", "shortName") VALUES (?, ?);`, ['Client B', 'CB'], true);
  });

  const getPayload = (businessId: number, clientId: number, num: string) => {
    const now = new Date().toISOString();
    return {
      invoiceType: InvoiceType.invoice,
      businessId,
      clientId,
      currencyId: 1, // EUR by default from init
      createdAt: now,
      updatedAt: now,
      issuedAt: now,
      invoiceNumber: num,
      isArchived: false,
      status: InvoiceStatus.unpaid,
      discountAmountCents: '0',
      discountPercent: 0,
      surchargeAmountCents: '0',
      surchargePercent: 0,
      taxRate: 0,
      shippingFeeCents: '0',
      invoicePayments: [],
      invoiceItems: [],
      invoiceAttachments: [],
      currencyFormat: 'USD',
      language: Language.en,
      invoiceBusinessSnapshot: {
        parentInvoiceId: -1,
        businessName: `Biz ${businessId}`,
        businessShortName: `B${businessId}`
      },
      invoiceClientSnapshot: {
        parentInvoiceId: -1,
        clientName: `Client ${clientId}`
      },
      invoiceCurrencySnapshot: {
        parentInvoiceId: -1,
        currencyCode: 'USD',
        currencySymbol: '$',
        currencySubunit: 100
      },
    } as any;
  };

  it('maintains isolation between concurrent write and read operations across workspaces', async () => {
    const bizA = await dbA.get<{ id: number }>('SELECT id FROM businesses');
    const cliA = await dbA.get<{ id: number }>('SELECT id FROM clients');
    const bizB = await dbB.get<{ id: number }>('SELECT id FROM businesses');
    const cliB = await dbB.get<{ id: number }>('SELECT id FROM clients');

    // Fire overlapping concurrent promises ACROSS workspaces
    const p1 = addInvoice(dbA, getPayload(bizA!.id, cliA!.id, 'INV-A-1'));
    const p2 = addInvoice(dbB, getPayload(bizB!.id, cliB!.id, 'INV-B-1'));
    await Promise.all([p1, p2]);

    const p3 = addInvoice(dbA, getPayload(bizA!.id, cliA!.id, 'INV-A-2'));
    const p4 = addInvoice(dbB, getPayload(bizB!.id, cliB!.id, 'INV-B-2'));
    await Promise.all([p3, p4]);

    const resA = await getInvoices(dbA, {});
    const resB = await getInvoices(dbB, {});

    // Workspace A should only have A's invoices
    expect(resA.length).toBe(2);
    expect(resA.map(i => i.invoiceNumber).sort()).toEqual(['INV-A-1', 'INV-A-2']);
    for (const inv of resA) {
      expect((inv as any).workspace_id).toBe('workspace-a');
    }

    // Workspace B should only have B's invoices
    expect(resB.length).toBe(2);
    expect(resB.map(i => i.invoiceNumber).sort()).toEqual(['INV-B-1', 'INV-B-2']);
    for (const inv of resB) {
      expect((inv as any).workspace_id).toBe('workspace-b');
    }
  });
});
