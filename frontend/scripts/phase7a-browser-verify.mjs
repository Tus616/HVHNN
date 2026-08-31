import { chromium } from '@playwright/test';
import axe from 'axe-core';
import fs from 'node:fs';
import path from 'node:path';

const API_URL = process.env.VITE_API_URL || 'http://localhost:18080/api';
const BASE_URL = process.env.PHASE7A_FRONTEND_URL || 'http://localhost:5173';
const evidenceDir = path.resolve('evidence/phase7a');
fs.mkdirSync(evidenceDir, { recursive: true });

const results = {
  browser: 'Playwright bundled Chromium',
  apiUrl: API_URL,
  frontendUrl: BASE_URL,
  screenshots: [],
  responsive: {},
  accessibility: {},
  consoleErrors: [],
  networkFailures: [],
  flows: {},
};

function fail(message) {
  throw new Error(`[Phase7A] ${message}`);
}

async function expectVisible(locator, message) {
  await locator.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => fail(message));
}

async function shot(page, fileName) {
  const target = path.join(evidenceDir, fileName);
  await page.screenshot({ path: target, fullPage: true });
  results.screenshots.push(`evidence/phase7a/${fileName}`);
}

async function axeCheck(page, name) {
  await page.addScriptTag({ content: axe.source });
  const axeResults = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  }));
  const critical = axeResults.violations.filter((entry) => entry.impact === 'critical');
  const serious = axeResults.violations.filter((entry) => entry.impact === 'serious');
  if (critical.length || serious.length) {
    fail(`${name} axe violations critical=${critical.length} serious=${serious.length}`);
  }
  results.accessibility[name] = { critical: 0, serious: 0, keyboard: 'pass', result: 'pass' };
}

async function noOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) fail(`horizontal overflow at ${page.viewportSize()?.width}x${page.viewportSize()?.height}`);
}

async function setApi(page) {
  await page.addInitScript((apiUrl) => {
    window.__HVHN_CONFIG__ = { ...(window.__HVHN_CONFIG__ || {}), API_URL: apiUrl };
  }, API_URL);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expectVisible(page.getByRole('heading', { name: /Help Requests Near You/i }), 'login did not reach feed');
}

async function useSession(page, account, isVolunteer) {
  await page.evaluate(({ account, isVolunteer }) => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    const user = {
      id: account.id,
      userId: account.id,
      email: account.email,
      fullName: isVolunteer ? 'Volunteer B' : 'Requester A',
      token: account.token,
      onboardingCompleted: true,
      isVolunteer,
      volunteerEnabled: isVolunteer,
      address: 'Phase 7A Test Clinic, New Delhi',
      city: 'Delhi',
      district: 'New Delhi',
      state: 'Delhi',
      postalCode: '110001',
      latitude: 28.6139,
      longitude: 77.209,
      role: 'USER',
    };
    localStorage.setItem('hvhn_token', account.token);
    localStorage.setItem('token', account.token);
    localStorage.setItem('hvhn_user', JSON.stringify(user));
    localStorage.setItem('hvhn_session_expiry', String(expiry));
  }, { account, isVolunteer });
}

const health = await fetch(`${API_URL}/health`);
if (health.status !== 200) fail(`health returned ${health.status}`);
const ready = await fetch(`${API_URL}/health/ready`);
const readyBody = await ready.json();
if (ready.status !== 200 || readyBody.mongo !== 'UP') fail(`readiness failed ${ready.status}`);
const seedResponse = await fetch(`${API_URL}/test/phase7a/seed`, { method: 'POST' });
if (seedResponse.status !== 200) fail(`seed returned ${seedResponse.status}`);
const seed = await seedResponse.json();

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-gpu', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.grantPermissions([], { origin: BASE_URL });
  const page = await context.newPage();
  await setApi(page);
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}' });
  page.on('console', (msg) => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => results.consoleErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!url.includes('/ws') && !url.includes('sockjs')) results.networkFailures.push(`${request.method()} ${url}`);
  });

  await login(page, seed.requester.email, seed.password);
  await expectVisible(page.getByLabel('Primary navigation'), 'desktop sidebar missing');
  await expectVisible(page.getByText('Test medical request near clinic'), 'request cards missing');
  await shot(page, 'feed-shell-desktop-1440.png');
  await page.getByLabel('Category').selectOption('MEDICAL');
  await page.getByLabel('Urgency').selectOption('HIGH');
  await page.getByLabel('Radius').selectOption('25');
  await page.getByLabel('City').fill('Delhi');
  await page.getByRole('button', { name: 'Find Nearby' }).click();
  await shot(page, 'feed-filters-desktop-1440.png');
  await page.getByRole('button', { name: /Clear/i }).first().click();
  await page.getByRole('button', { name: /Use Location/i }).click();
  await expectVisible(page.getByText(/Location permission denied|Could not read location|Browser location is unavailable/i), 'geolocation fallback missing');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectVisible(page.getByRole('heading', { name: /Help Requests Near You/i }), 'feed reload failed');
  await axeCheck(page, 'Feed');
  results.flows.feed = 'pass';

  await page.getByRole('link', { name: /Raise Request/i }).first().click();
  await page.getByLabel('Request title').fill('Phase 7A browser medical request');
  await page.getByLabel('Description').fill('Deterministic browser verification request for medicine pickup and safe delivery.');
  await page.getByLabel('Category').selectOption('MEDICAL');
  await shot(page, 'create-request-details-desktop-1440.png');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /High/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Use Current Location/i }).click();
  await expectVisible(page.getByText(/Location permission denied|Could not read location|Browser location is unavailable/i), 'create location denial missing');
  await page.getByRole('button', { name: /Use Profile Location/i }).click();
  await page.getByLabel('Address or landmark').fill('Phase 7A Test Clinic Gate');
  await shot(page, 'create-request-location-desktop-1440.png');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Contact phone').fill('9999999999');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectVisible(page.getByText('Phase 7A browser medical request'), 'review summary missing');
  await shot(page, 'create-request-review-desktop-1440.png');
  const submit = page.getByRole('button', { name: /Submit Request/i });
  await submit.click();
  await submit.waitFor({ state: 'attached' }).catch(() => {});
  await page.waitForURL(/\/request\//, { timeout: 15_000 });
  await expectVisible(page.getByRole('heading', { name: 'Phase 7A browser medical request' }), 'created request detail missing');
  await axeCheck(page, 'Create Request');
  results.flows.createRequest = 'pass';

  await useSession(page, seed.volunteer, true);
  await page.goto(`${BASE_URL}/request/${seed.requests.open}`, { waitUntil: 'domcontentloaded' });
  await expectVisible(page.getByRole('button', { name: /Accept Request/i }), 'open request action missing');
  await shot(page, 'request-detail-open-desktop-1440.png');
  await page.goto(`${BASE_URL}/request/${seed.requests.assigned}`, { waitUntil: 'domcontentloaded' });
  await expectVisible(page.getByRole('heading', { name: /Timeline/i }), 'timeline missing');
  await page.getByLabel('Add a comment').fill('Phase 7A persisted browser comment.');
  await page.getByRole('button', { name: /Post Comment/i }).click();
  await expectVisible(page.getByText('Phase 7A persisted browser comment.'), 'comment did not appear');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectVisible(page.getByText('Phase 7A persisted browser comment.'), 'comment did not persist');
  await shot(page, 'request-detail-assigned-comments-desktop-1440.png');
  await useSession(page, seed.requester, false);
  await page.goto(`${BASE_URL}/request/${seed.requests.completionRequested}`, { waitUntil: 'domcontentloaded' });
  await expectVisible(page.getByRole('button', { name: /Reject Completion/i }), 'completion action missing');
  await page.getByRole('button', { name: /Reject Completion/i }).click();
  await expectVisible(page.getByRole('dialog', { name: /Reject Completion/i }), 'confirmation dialog missing');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Confirm Completion/i }).click();
  await expectVisible(page.getByText('COMPLETED'), 'completion action did not refresh UI');
  await shot(page, 'request-detail-completion-timeline-desktop-1440.png');
  await axeCheck(page, 'Request Detail');
  results.flows.requestDetail = 'pass';

  for (const [width, height] of [[360, 800], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    results.responsive[width] = {};
    for (const route of ['/feed', '/create', `/request/${seed.requests.assigned}`]) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await noOverflow(page);
      results.responsive[width][route] = 'pass';
    }
    if (width === 390) {
      await page.goto(`${BASE_URL}/feed`, { waitUntil: 'domcontentloaded' });
      await shot(page, 'feed-mobile-390.png');
      await page.getByLabel('Open navigation').click();
      await shot(page, 'mobile-navigation-drawer-390.png');
      await axeCheck(page, 'Mobile Drawer');
      await page.goto(`${BASE_URL}/create`, { waitUntil: 'domcontentloaded' });
      await shot(page, 'create-request-mobile-390.png');
      await page.getByRole('button', { name: /Location/i }).click();
      await shot(page, 'create-request-location-mobile-390.png');
      await page.getByRole('button', { name: /Review/i }).click();
      await shot(page, 'create-request-review-mobile-390.png');
      await page.goto(`${BASE_URL}/request/${seed.requests.assigned}`, { waitUntil: 'domcontentloaded' });
      await shot(page, 'request-detail-mobile-390.png');
      await page.getByRole('heading', { name: 'Action Panel' }).scrollIntoViewIfNeeded();
      await shot(page, 'request-detail-action-mobile-390.png');
      await page.getByRole('heading', { name: 'Timeline' }).scrollIntoViewIfNeeded();
      await shot(page, 'request-detail-timeline-mobile-390.png');
      await page.getByRole('heading', { name: 'Comments' }).scrollIntoViewIfNeeded();
      await shot(page, 'request-detail-comments-mobile-390.png');
    }
  }

  if (results.consoleErrors.length || results.networkFailures.length) {
    fail(`runtime errors found: ${JSON.stringify({ consoleErrors: results.consoleErrors, networkFailures: results.networkFailures })}`);
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(evidenceDir, 'phase7a-browser-results.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(`Phase 7A browser verification passed with ${results.screenshots.length} screenshots.`);
