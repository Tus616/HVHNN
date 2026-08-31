import { expect } from '@playwright/test';
import axe from 'axe-core';
import fs from 'node:fs';
import path from 'node:path';

export const API_URL = process.env.VITE_API_URL || 'http://localhost:18080/api';
export const EVIDENCE_DIR = path.resolve('evidence/phase7a');

export function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export async function seedPhase7A(request) {
  const response = await request.post(`${API_URL}/test/phase7a/seed`);
  expect(response.status(), `Phase 7A seed endpoint at ${API_URL}`).toBe(200);
  return response.json();
}

export async function installGuards(page, ignored = []) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText || 'unknown';
    if (url.includes('/ws') || url.includes('sockjs') || ignored.some((item) => url.includes(item))) return;
    errors.push(`requestfailed: ${request.method()} ${url} ${failure}`);
  });
  return {
    errors,
    assertClean() {
      expect(errors, 'No fatal console, page, or core network errors').toEqual([]);
    },
  };
}

export async function stabilizePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
}

export async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: /Help Requests Near You/i })).toBeVisible();
}

export async function useSession(page, account) {
  await page.addInitScript(({ user, token }) => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    const storedUser = {
      id: user.id,
      userId: user.id,
      email: user.email,
      fullName: user.email.includes('volunteer') ? 'Volunteer B' : 'Requester A',
      token,
      onboardingCompleted: true,
      isVolunteer: user.email.includes('volunteer'),
      volunteerEnabled: user.email.includes('volunteer'),
      address: 'Phase 7A Test Clinic, New Delhi',
      city: 'Delhi',
      district: 'New Delhi',
      state: 'Delhi',
      postalCode: '110001',
      latitude: 28.6139,
      longitude: 77.209,
      role: 'USER',
    };
    window.localStorage.setItem('hvhn_token', token);
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('hvhn_user', JSON.stringify(storedUser));
    window.localStorage.setItem('hvhn_session_expiry', String(expiry));
  }, { user: account, token: account.token });
}

export async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow, 'No horizontal page overflow').toBe(false);
}

export async function runAxe(page) {
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  }));
  return {
    critical: results.violations.filter((violation) => violation.impact === 'critical'),
    serious: results.violations.filter((violation) => violation.impact === 'serious'),
    raw: results,
  };
}

export function writeJsonEvidence(fileName, payload) {
  ensureEvidenceDir();
  fs.writeFileSync(path.join(EVIDENCE_DIR, fileName), `${JSON.stringify(payload, null, 2)}\n`);
}

export async function screenshot(page, fileName, fullPage = true) {
  ensureEvidenceDir();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, fileName), fullPage });
}

export async function openMobileDrawer(page) {
  await page.getByLabel('Open navigation').click();
  await expect(page.getByLabel('Primary navigation')).toBeVisible();
}
