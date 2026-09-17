import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const apiBaseUrl = 'http://127.0.0.1:3013';

function getTokenFromEmailLog(email: string): string | null {
  const logPath = path.resolve(process.cwd(), 'email.log');
  if (!fs.existsSync(logPath)) return null;
  const content = fs.readFileSync(logPath, 'utf8');
  const encodedEmail = encodeURIComponent(email);
  const regex = new RegExp(`token=([^&]+)&email=${encodedEmail}`);
  const match = content.match(regex);
  return match ? match[1] : null;
}

test.skip('web mode selects a seeded V2 layout', async ({ page }) => {
  const email = `v2user_${Date.now()}@example.com`;
  const password = 'Password123!';

  // Register
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('input[type="password"]').nth(1).fill(password);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await page.waitForURL(/\/verify-email/);
  
  let token = null;
  for (let i = 0; i < 10; i++) {
    token = getTokenFromEmailLog(email);
    if (token) break;
    await page.waitForTimeout(500);
  }
  
  await page.getByLabel('Token').fill(token!);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForSelector('text=Email verified successfully');

  // Login
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/invoices/);

  // Seed layout using authenticated request context
  const layoutResponse = await page.request.post(`/api/layouts`, {
    data: {
      isArchived: false,
      schema: {
        schemaVersion: 2,
        meta: { name: 'E2E V2 Sidebar' },
        regions: [
          {
            id: 'sidebar',
            width: '30%',
            direction: 'column',
            children: [{ type: 'block', block: { type: 'businessInfo' } }]
          },
          {
            id: 'main',
            width: '70%',
            direction: 'column',
            children: [{ type: 'section', section: { type: 'itemsTable', visible: true } }]
          }
        ]
      }
    }
  });
  expect(layoutResponse.ok()).toBe(true);

  await page.goto('/layouts');
  await expect(page.locator('body')).toContainText('E2E V2 Sidebar');
  await expect(page.locator('body')).not.toContainText('Application error');
});
