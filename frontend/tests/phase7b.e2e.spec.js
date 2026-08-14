import { expect, test } from '@playwright/test';
import { assertNoHorizontalOverflow, mockPhase7BApi, stabilizePage, usePhase7BSession } from './phase7b.helpers.js';

test.describe('Phase 7B community browser flow', () => {
  test('discovery to community modules and management route with deterministic API responses', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await usePhase7BSession(page);
    await mockPhase7BApi(page);
    await page.goto('/communities');
    await stabilizePage(page);

    await expect(page.getByRole('heading', { name: 'Communities' })).toBeVisible();
    await page.getByLabel('Search communities').fill('campus');
    await expect(page.getByText('Campus Helpers')).toBeVisible();
    await page.getByRole('link', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Campus Helpers' }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Requests' }).click();
    await expect(page.getByText('Need textbooks')).toBeVisible();
    await page.getByRole('tab', { name: 'Q&A' }).click();
    await page.getByRole('button', { name: /Where should new volunteers meet/i }).click();
    await expect(page.getByText('Use the library desk near Gate 2.')).toBeVisible();
    await page.getByRole('button', { name: /Back to Q&A/i }).click();
    await page.getByRole('tab', { name: 'Campaigns' }).click();
    await page.getByRole('button', { name: /Open campaign/i }).click();
    await expect(page.getByText(/No payment is processed here/i)).toBeVisible();
    await page.getByRole('tab', { name: 'Members' }).click();
    await expect(page.getByText('Other Helper')).toBeVisible();
    await page.getByRole('tab', { name: 'Announcements' }).click();
    await expect(page.getByText('Coordination desk open')).toBeVisible();
    await page.getByRole('link', { name: 'Manage' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Campus Helpers' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
