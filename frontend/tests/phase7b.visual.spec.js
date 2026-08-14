import { expect, test } from '@playwright/test';
import { assertNoHorizontalOverflow, mockPhase7BApi, runAxe, screenshot, stabilizePage, usePhase7BSession } from './phase7b.helpers.js';

async function openAuthed(page, path, viewport) {
  await page.setViewportSize(viewport);
  await usePhase7BSession(page);
  await mockPhase7BApi(page);
  await page.goto(path);
  await stabilizePage(page);
}

test.describe('Phase 7B visual baselines', () => {
  test('community discovery desktop and mobile', async ({ page }) => {
    await openAuthed(page, '/communities', { width: 1440, height: 900 });
    await expect(page.getByRole('heading', { name: 'Communities' })).toBeVisible();
    await screenshot(page, 'discovery-1440x900.png');
    await expect(page).toHaveScreenshot('phase7b-discovery-desktop.png', { fullPage: true });
    await assertNoHorizontalOverflow(page);

    await openAuthed(page, '/communities', { width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Communities' })).toBeVisible();
    await screenshot(page, 'discovery-390x844.png');
    await expect(page).toHaveScreenshot('phase7b-discovery-mobile.png', { fullPage: true });
    await assertNoHorizontalOverflow(page);
  });

  test('dashboard and members desktop/mobile', async ({ page }) => {
    await openAuthed(page, '/community/c1', { width: 1440, height: 900 });
    await expect(page.getByRole('heading', { name: 'Campus Helpers' }).first()).toBeVisible();
    await screenshot(page, 'dashboard-1440x900.png');
    await expect(page).toHaveScreenshot('phase7b-dashboard-desktop.png', { fullPage: true });

    await page.getByRole('tab', { name: 'Members' }).click();
    await expect(page.getByText('Other Helper')).toBeVisible();
    await screenshot(page, 'members-1440x900.png');
    await expect(page).toHaveScreenshot('phase7b-members-desktop.png', { fullPage: true });

    await openAuthed(page, '/community/c1', { width: 390, height: 844 });
    await screenshot(page, 'dashboard-390x844.png');
    await page.getByRole('tab', { name: 'Members' }).click();
    await screenshot(page, 'members-390x844.png');
    await assertNoHorizontalOverflow(page);
  });

  test('Q&A and campaign detail desktop/mobile with axe sample', async ({ page }) => {
    await openAuthed(page, '/community/c1', { width: 1440, height: 900 });
    await page.getByRole('tab', { name: 'Q&A' }).click();
    await expect(page.getByText('Where should new volunteers meet?')).toBeVisible();
    await screenshot(page, 'qa-list-1440x900.png');
    await expect(page).toHaveScreenshot('phase7b-qa-desktop.png', { fullPage: true });
    await page.getByRole('button', { name: /Where should new volunteers meet/i }).click();
    await screenshot(page, 'question-detail-1440x900.png');

    await page.getByRole('tab', { name: 'Campaigns' }).click();
    await page.getByRole('button', { name: /Open campaign/i }).click();
    await expect(page.getByText(/No payment is processed here/i)).toBeVisible();
    await screenshot(page, 'campaign-detail-1440x900.png');
    await expect(page).toHaveScreenshot('phase7b-campaign-detail-desktop.png', { fullPage: true });

    const axeResults = await runAxe(page);
    expect(axeResults.violations.filter((item) => item.impact === 'critical')).toEqual([]);
    expect(axeResults.violations.filter((item) => item.impact === 'serious')).toEqual([]);

    await openAuthed(page, '/community/c1', { width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Campaigns' }).click();
    await page.getByRole('button', { name: /Open campaign/i }).click();
    await screenshot(page, 'campaign-detail-390x844.png');
    await assertNoHorizontalOverflow(page);
  });
});
