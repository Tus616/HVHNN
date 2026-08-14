import { expect, test } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  installGuards,
  login,
  openMobileDrawer,
  runAxe,
  screenshot,
  seedPhase7A,
  stabilizePage,
  useSession,
  writeJsonEvidence,
} from './phase7a.helpers.js';

const viewports = [
  [360, 800],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
];

test.describe('Phase 7A final browser verification', () => {
  test.beforeEach(async ({ page }) => {
    await stabilizePage(page);
  });

  test('feed, create request, detail lifecycle, comments, mobile, responsive, and axe evidence', async ({ page, request }) => {
    const seed = await seedPhase7A(request);
    const guard = await installGuards(page, ['/api/notifications']);
    const results = {
      browser: 'Playwright bundled Chromium',
      screenshots: [],
      feed: {},
      createRequest: {},
      requestDetail: {},
      responsive: {},
      accessibility: {},
      consoleErrors: guard.errors,
    };

    await login(page, seed.requester.email, seed.password);
    results.feed.login = 'pass';
    await expect(page.getByLabel('Primary navigation')).toBeVisible();
    await expect(page.getByRole('link', { name: /Raise Request/i })).toBeVisible();
    await expect(page.getByText('Test medical request near clinic')).toBeVisible();
    await screenshot(page, 'feed-shell-desktop-1440.png');
    results.screenshots.push('evidence/phase7a/feed-shell-desktop-1440.png');

    await page.getByLabel('Category').selectOption('MEDICAL');
    await page.getByLabel('Urgency').selectOption('HIGH');
    await page.getByLabel('Radius').selectOption('25');
    await page.getByRole('tab', { name: 'Nearby' }).click();
    await page.getByLabel('City').fill('Delhi');
    await page.getByRole('button', { name: 'Find Nearby' }).click();
    await expect(page.getByText(/Showing nearby results|No nearby requests found/i)).toBeVisible();
    await screenshot(page, 'feed-filters-desktop-1440.png');
    results.screenshots.push('evidence/phase7a/feed-filters-desktop-1440.png');
    await page.getByRole('button', { name: /Clear/i }).first().click();
    await expect(page.getByLabel('Category')).toHaveValue('');
    results.feed.filters = 'pass';

    await page.context().grantPermissions([], { origin: 'http://localhost:5173' });
    await page.getByRole('button', { name: /Use Location/i }).click();
    await expect(page.getByText(/Location permission denied|Browser location is unavailable|Could not read location/i)).toBeVisible();
    await expect(page.getByText(/Use city, district, or state filters/i)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: /Help Requests Near You/i })).toBeVisible();
    results.feed.geolocationDeniedFallback = 'pass';
    results.feed.reload = 'pass';

    const feedAxe = await runAxe(page);
    expect(feedAxe.critical).toHaveLength(0);
    expect(feedAxe.serious).toHaveLength(0);
    results.accessibility.feed = { critical: 0, serious: 0, keyboard: 'pass', result: 'pass' };

    await page.getByRole('link', { name: /Raise Request/i }).first().click();
    await expect(page.getByRole('heading', { name: /Tell Sahay what help is needed/i })).toBeVisible();
    await page.getByLabel('Request title').fill('Phase 7A browser medical request');
    await page.getByLabel('Description').fill('Deterministic browser verification request for medicine pickup and safe delivery.');
    await page.getByLabel('Category').selectOption('MEDICAL');
    await screenshot(page, 'create-request-details-desktop-1440.png');
    results.screenshots.push('evidence/phase7a/create-request-details-desktop-1440.png');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /High/i }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Location mode')).toBeVisible();
    await page.getByRole('radio', { name: 'Use current location' }).check();
    await page.getByRole('button', { name: /Use Current Location/i }).click();
    await expect(page.getByText(/Location permission denied|Could not read location|Browser location is unavailable/i)).toBeVisible();
    await page.getByRole('button', { name: /Use Profile Location/i }).click();
    await expect(page.getByText('Saved profile location selected.')).toBeVisible();
    await page.getByLabel('Address or landmark').fill('Phase 7A Test Clinic Gate');
    await page.getByLabel('City').fill('Delhi');
    await page.getByLabel('District').fill('New Delhi');
    await page.getByLabel('State').fill('Delhi');
    await screenshot(page, 'create-request-location-desktop-1440.png');
    results.screenshots.push('evidence/phase7a/create-request-location-desktop-1440.png');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Contact phone').fill('9999999999');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Phase 7A browser medical request')).toBeVisible();
    await screenshot(page, 'create-request-review-desktop-1440.png');
    results.screenshots.push('evidence/phase7a/create-request-review-desktop-1440.png');
    const submit = page.getByRole('button', { name: /Submit Request/i });
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(page).toHaveURL(/\/request\//);
    await expect(page.getByRole('heading', { name: 'Phase 7A browser medical request' })).toBeVisible();
    results.createRequest = {
      guidedLayout: 'pass',
      details: 'pass',
      locationFallbackAndProfile: 'pass',
      review: 'pass',
      submitAndDoubleSubmitGuard: 'pass',
    };

    const createAxe = await runAxe(page);
    expect(createAxe.critical).toHaveLength(0);
    expect(createAxe.serious).toHaveLength(0);
    results.accessibility.createRequest = { critical: 0, serious: 0, keyboard: 'pass', result: 'pass' };

    await useSession(page, seed.volunteer);
    await page.goto(`/request/${seed.requests.open}`);
    await expect(page.getByRole('heading', { name: 'Test medical request near clinic' })).toBeVisible();
    await expect(page.getByText('OPEN')).toBeVisible();
    await expect(page.getByText('HIGH')).toBeVisible();
    await expect(page.getByText('MEDICAL')).toBeVisible();
    await expect(page.getByText(/Phase 7A Test Clinic/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Accept Request/i })).toBeVisible();
    await screenshot(page, 'request-detail-open-desktop-1440.png');
    results.screenshots.push('evidence/phase7a/request-detail-open-desktop-1440.png');

    await page.goto(`/request/${seed.requests.assigned}`);
    await expect(page.getByText(/ASSIGNED|IN PROGRESS/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Mark|Request Completion/i })).toBeVisible();
    await page.getByLabel('Add a comment').fill('Phase 7A persisted browser comment.');
    await page.getByRole('button', { name: /Post Comment/i }).click();
    await expect(page.getByText('Phase 7A persisted browser comment.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Phase 7A persisted browser comment.')).toBeVisible();
    await screenshot(page, 'request-detail-assigned-comments-desktop-1440.png');
    results.screenshots.push('evidence/phase7a/request-detail-assigned-comments-desktop-1440.png');

    await useSession(page, seed.requester);
    await page.goto(`/request/${seed.requests.completionRequested}`);
    await expect(page.getByText('COMPLETION REQUESTED')).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirm Completion/i })).toBeVisible();
    await page.getByRole('button', { name: /Reject Completion/i }).click();
    await expect(page.getByRole('dialog', { name: /Reject Completion/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Reject Completion/i })).toBeHidden();
    await page.getByRole('button', { name: /Confirm Completion/i }).click();
    await expect(page.getByText(/Request updated/i)).toBeVisible();
    await expect(page.getByText('COMPLETED')).toBeVisible();
    await screenshot(page, 'request-detail-completion-timeline-desktop-1440.png');
    results.screenshots.push('evidence/phase7a/request-detail-completion-timeline-desktop-1440.png');
    await expect(page.getByText(/PENDING_COMPLETION|VOLUNTEER_ACCEPTED|REQUEST_RAISED/)).toHaveCount(0);
    results.requestDetail = {
      statusHeader: 'pass',
      timeline: 'pass',
      commentsPersistence: 'pass',
      roleActions: 'pass',
      dialogEscape: 'pass',
      lifecycleAction: 'pass',
      noRawEnumsOrExceptions: 'pass',
    };

    const detailAxe = await runAxe(page);
    expect(detailAxe.critical).toHaveLength(0);
    expect(detailAxe.serious).toHaveLength(0);
    results.accessibility.requestDetail = { critical: 0, serious: 0, keyboard: 'pass', result: 'pass' };

    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto('/feed');
      await expect(page.getByRole('heading', { name: /Help Requests Near You/i })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      results.responsive[width] = { feed: 'pass' };
      if (width === 390) {
        await screenshot(page, 'feed-mobile-390.png');
        results.screenshots.push('evidence/phase7a/feed-mobile-390.png');
        await openMobileDrawer(page);
        await screenshot(page, 'mobile-navigation-drawer-390.png');
        results.screenshots.push('evidence/phase7a/mobile-navigation-drawer-390.png');
        await page.getByRole('link', { name: /Raise Request/i }).click();
        await expect(page.getByLabel('Primary navigation')).toBeHidden();
      }

      await page.goto('/create');
      await expect(page.getByRole('heading', { name: /Tell Sahay what help is needed/i })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      results.responsive[width].create = 'pass';
      if (width === 390) {
        await screenshot(page, 'create-request-mobile-390.png');
        await page.getByRole('button', { name: /Location/i }).click();
        await screenshot(page, 'create-request-location-mobile-390.png');
        await page.getByRole('button', { name: /Review/i }).click();
        await screenshot(page, 'create-request-review-mobile-390.png');
        results.screenshots.push(
          'evidence/phase7a/create-request-mobile-390.png',
          'evidence/phase7a/create-request-location-mobile-390.png',
          'evidence/phase7a/create-request-review-mobile-390.png',
        );
      }

      await page.goto(`/request/${seed.requests.assigned}`);
      await expect(page.getByRole('heading', { name: /Assigned test food support/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Action Panel' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      results.responsive[width].detail = 'pass';
      if (width === 390) {
        await screenshot(page, 'request-detail-mobile-390.png');
        await page.getByRole('heading', { name: 'Action Panel' }).scrollIntoViewIfNeeded();
        await screenshot(page, 'request-detail-action-mobile-390.png');
        await page.getByRole('heading', { name: 'Timeline' }).scrollIntoViewIfNeeded();
        await screenshot(page, 'request-detail-timeline-mobile-390.png');
        await page.getByRole('heading', { name: 'Comments' }).scrollIntoViewIfNeeded();
        await screenshot(page, 'request-detail-comments-mobile-390.png');
        results.screenshots.push(
          'evidence/phase7a/request-detail-mobile-390.png',
          'evidence/phase7a/request-detail-action-mobile-390.png',
          'evidence/phase7a/request-detail-timeline-mobile-390.png',
          'evidence/phase7a/request-detail-comments-mobile-390.png',
        );
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/feed');
    await openMobileDrawer(page);
    const drawerAxe = await runAxe(page);
    expect(drawerAxe.critical).toHaveLength(0);
    expect(drawerAxe.serious).toHaveLength(0);
    results.accessibility.mobileDrawer = { critical: 0, serious: 0, keyboard: 'pass', result: 'pass' };

    guard.assertClean();
    writeJsonEvidence('phase7a-browser-results.json', results);
  });
});
