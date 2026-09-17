import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';


const safeWaitForURL = async (urlRegex: RegExp) => {
  try {
    await page.waitForURL(urlRegex, { timeout: 15000 });
  } catch (err) {
    console.error(`Failed to wait for URL: ${urlRegex}`);
    console.error(`Current URL: ${page.url()}`);
    console.error(`Page body:\n`, await page.locator('body').innerHTML());
    throw err;
  }
};

const apiBaseUrl = 'http://127.0.0.1:3013';

test.describe.configure({ mode: 'serial' });

let testEmail = `newuser_${Date.now()}@example.com`;
const testPassword = 'Password123!';

let page: any;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  const logPath = path.resolve(process.cwd(), 'email.log');
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
});

test.afterAll(async () => {
  await page.close();
});

function getTokenFromEmailLog(email: string): string | null {
  const logPath = path.resolve(process.cwd(), 'email.log');
  if (!fs.existsSync(logPath)) return null;
  const content = fs.readFileSync(logPath, 'utf8');
  const encodedEmail = encodeURIComponent(email);
  const regex = new RegExp(`token=([^&]+)&email=${encodedEmail}`);
  const match = content.match(regex);
  return match ? match[1] : null;
}

test('1. New user -> register -> verify -> login -> /invoices', async () => {
  // Register
  await page.goto('/register');
  await page.getByLabel('Email').fill(testEmail);
  await page.locator('input[type="password"]').first().fill(testPassword);
  await page.locator('input[type="password"]').nth(1).fill(testPassword);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  // Wait for verification success message
  await expect(page.getByText('Registration successful')).toBeVisible();

  // It redirects to /verify-email. Wait for it.
  await safeWaitForURL(/\/verify-email/);

  // Extract token from email.log
  // Since email sending is async, poll it a bit
  let token = null;
  for (let i = 0; i < 10; i++) {
    token = getTokenFromEmailLog(testEmail);
    if (token) break;
    await page.waitForTimeout(500);
  }
  expect(token).toBeTruthy();

  // Verify
  await page.getByLabel('Verification Token').fill(token!);
  await page.getByRole('button', { name: 'Verify' }).click();

  try {
    await expect(page.getByText('Email verified successfully')).toBeVisible();
  } catch (err) {
    console.error('Failed to find success message. Page text:', await page.locator('body').innerText());
    throw err;
  }

  // Wait for automatic redirect
  await safeWaitForURL(/\/login/);

  // Login
  await page.getByLabel('Email').fill(testEmail);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Should navigate straight to /invoices because of auto-provisioning
  await safeWaitForURL(/\/invoices/);
  await expect(page.getByText('Invoices', { exact: true }).first()).toBeVisible();
});

test('2. Existing user with one DB -> /invoices', async () => {
  // Logout first since we're using shared page
  await page.locator('text="Log out"').click({ force: true });
  await page.getByRole('button', { name: 'Confirm' }).click();
  await safeWaitForURL(/\/home/);

  // The user from test 1 now has exactly 1 local DB.
  await page.goto('/login');
  await page.getByLabel('Email').fill(testEmail);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await safeWaitForURL(/\/invoices/);
  await expect(page.getByText('Invoices', { exact: true }).first()).toBeVisible();
});

test('3. Authenticated / -> /invoices', async () => {
  // Already logged in from test 2
  // Visit root
  await page.goto('/');
  await safeWaitForURL(/\/invoices/);
});

test('4. No automatic Local / Server chooser', async () => {
  // This is checked implicitly by the fact that we hit /invoices directly
  // But let's explicitly verify we aren't seeing the old server/local chooser
  const chooser = page.getByText('Local', { exact: true });
  await expect(chooser).not.toBeVisible();
});

test('5. Explicit Switch Workspace -> /select-database', async () => {
  // Already at /invoices
  // Click Switch Workspace in sidebar
  await page.locator('text="Switch Workspace"').click({ force: true });
  
  await safeWaitForURL(/\/select-database/);
  await expect(page.getByRole('heading', { name: 'Select Workspace' })).toBeVisible();
});

test('6. Create Local Workspace -> /invoices', async () => {
  // Click Create New Workspace
  await page.getByRole('button', { name: 'Create New Workspace' }).click();

  // It should automatically create, open, and redirect to /invoices
  await safeWaitForURL(/\/invoices/);
});

test('7. Multiple DBs -> /select-database', async () => {
  // Logout first so we can test the login flow with multiple DBs
  await page.locator('text="Log out"').click({ force: true });
  await page.getByRole('button', { name: 'Confirm' }).click();
  await safeWaitForURL(/\/home/);

  // Login again
  await page.goto('/login');
  await page.getByLabel('Email').fill(testEmail);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Since user has 2 databases, they should be taken to /select-database
  await safeWaitForURL(/\/select-database/);
  try {
    await expect(page.getByRole('heading', { name: 'Select Workspace' })).toBeVisible();
  } catch (e) {
    console.log("BODY HTML:", await page.locator('body').innerHTML());
    throw e;
  }
});

test('8. Select DB -> /invoices', async () => {
  // We are at /select-database
  // Click the first local database card
  await page.getByRole('button', { name: 'Open' }).first().click();
  await safeWaitForURL(/\/invoices/);
});

test('9. Logout -> /login', async () => {
  await page.locator('text="Log out"').click({ force: true });
  await page.getByRole('button', { name: 'Confirm' }).click();
  await safeWaitForURL(/\/home/);
  
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
});

test('10. No automatic Server setup', async () => {
  // Server databases require explicit setup. We just verify the flow didn't leak them.
  // We are on login, login again
  await page.getByLabel('Email').fill(testEmail);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await safeWaitForURL(/\/select-database/);
  
  // It shouldn't prompt for local/server chooser, it should just list local DBs
  await expect(page.getByText('Set up connection')).not.toBeVisible();
  await expect(page.getByText('Host')).not.toBeVisible();
  await expect(page.getByText('Port')).not.toBeVisible();
});

