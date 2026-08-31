import { expect, test } from '@playwright/test';
import { seedPhase7A, stabilizePage, useSession } from './phase7a.helpers.js';

test.describe('Phase 7A visual baselines', () => {
  test.beforeEach(async ({ page }) => {
    await stabilizePage(page);
  });

  test('feed desktop and mobile', async ({ page, request }) => {
    const seed = await seedPhase7A(request);
    await useSession(page, seed.requester);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/feed');
    await expect(page.getByRole('heading', { name: /Help Requests Near You/i })).toBeVisible();
    await expect(page).toHaveScreenshot('phase7a-feed-desktop.png', { fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/feed');
    await expect(page.getByRole('heading', { name: /Help Requests Near You/i })).toBeVisible();
    await expect(page).toHaveScreenshot('phase7a-feed-mobile.png', { fullPage: true });
  });

  test('create request desktop and mobile', async ({ page, request }) => {
    const seed = await seedPhase7A(request);
    await useSession(page, seed.requester);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/create');
    await expect(page.getByRole('heading', { name: /Tell Sahay what help is needed/i })).toBeVisible();
    await expect(page).toHaveScreenshot('phase7a-create-request-desktop.png', { fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/create');
    await expect(page.getByRole('heading', { name: /Tell Sahay what help is needed/i })).toBeVisible();
    await expect(page).toHaveScreenshot('phase7a-create-request-mobile.png', { fullPage: true });
  });

  test('request detail desktop and mobile', async ({ page, request }) => {
    const seed = await seedPhase7A(request);
    await useSession(page, seed.volunteer);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/request/${seed.requests.assigned}`);
    await expect(page.getByRole('heading', { name: /Assigned test food support/i })).toBeVisible();
    await expect(page).toHaveScreenshot('phase7a-request-detail-desktop.png', { fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/request/${seed.requests.assigned}`);
    await expect(page.getByRole('heading', { name: /Assigned test food support/i })).toBeVisible();
    await expect(page).toHaveScreenshot('phase7a-request-detail-mobile.png', { fullPage: true });
  });
});
