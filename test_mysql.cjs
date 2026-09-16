const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    console.log("Navigating to http://127.0.0.1:5173 ...");
    await page.goto('http://127.0.0.1:5173');
    
    console.log("Clicking Server tab...");
    await page.getByRole('tab', { name: 'Server' }).click();

    console.log("Clicking Connect button...");
    await page.getByRole('button', { name: 'Connect' }).click();

    console.log("Waiting for Add Database modal...");
    await page.getByText('Add Database').waitFor();
    
    console.log("Toggling MySQL...");
    await page.getByRole('checkbox', { name: 'PostgreSQL' }).click(); // The label might be PostgreSQL before click

    console.log("Filling Host...");
    await page.getByLabel('Host *').fill('127.0.0.1');
    
    console.log("Filling Port...");
    await page.getByLabel('Port *').fill('3306');

    console.log("Filling Database...");
    await page.getByLabel('Database *').fill('invoice_builder');

    console.log("Filling User...");
    await page.getByLabel('User *').fill('root');
    
    console.log("Testing Connection...");
    await page.getByRole('button', { name: 'Test Connection' }).click();

    console.log("Waiting for success toast...");
    await page.getByText('Connection successful').waitFor({ timeout: 10000 });
    console.log("Connection successful!");

    console.log("Clicking Save...");
    await page.getByRole('button', { name: 'Save' }).click();

    console.log("Clicking the new database tile...");
    await page.getByText('invoice_builder').first().click();

    console.log("Waiting for Dashboard to load...");
    await page.getByRole('button', { name: /Dashboard/i }).waitFor({ timeout: 10000 });
    console.log("Dashboard loaded successfully!");

    console.log("Navigating to Clients...");
    await page.getByRole('button', { name: /Clients/i }).click();

    console.log("Waiting a bit for render...");
    await page.waitForTimeout(1000);

    console.log("Clicking Add Client...");
    await page.locator('button[aria-label="Add"]').first().click();

    console.log("Filling Client Name...");
    await page.getByLabel('Name *').fill('Test MySQL Client');
    await page.getByLabel('Short Name *').fill('TM');

    console.log("Saving Client...");
    await page.getByRole('button', { name: 'Save' }).click();
    console.log("Client saved successfully!");

    console.log("ALL E2E TESTS PASSED!");
  } catch(e) {
    console.error("Test failed:", e);
    await page.screenshot({ path: path.join(__dirname, 'error.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
