import { test, expect } from '@playwright/test';

test.describe('Product Digital Passport E2E Journey', () => {
  test('should allow a brand user to login and create a product draft', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'editor@notarify.test');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Seed OWNER lands on the dashboard, then navigate to products.
    await expect(page).toHaveURL(/\/($|\?)/);
    await page.goto('/products');

    await page.getByRole('button', { name: /new product|create/i }).first().click();

    const uniqueSuffix = Date.now().toString().slice(-6);
    const productName = `E2E Test Product ${uniqueSuffix}`;
    const sku = `E2E-${uniqueSuffix}`;

    await page.fill('input[name="name"]', productName);
    await page.fill('input[name="sku"]', sku);
    await page.getByRole('button', { name: /create draft/i }).click();

    await expect(page).toHaveURL(/\/products\/[0-9a-fA-F-]+/);
    await expect(page.getByText(productName).first()).toBeVisible();

    // Preview tab is reachable on a fresh draft (draft mode / empty published snapshot).
    await page.getByRole('tab', { name: /preview/i }).click();
    await expect(page.getByText(/preview|draft|not published|passport/i).first()).toBeVisible();
  });

  test('public passport route renders a not-found state for unknown UUID', async ({ page }) => {
    await page.goto('/passport/00000000-0000-4000-8000-000000000099');
    await expect(page.getByText(/isn't available|not available/i)).toBeVisible();
  });
});
