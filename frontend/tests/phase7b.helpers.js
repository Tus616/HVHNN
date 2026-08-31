import { expect } from '@playwright/test';
import axe from 'axe-core';
import fs from 'node:fs';
import path from 'node:path';

export const EVIDENCE_DIR = path.resolve('evidence/phase7b');

export const community = {
  id: 'c1',
  name: 'Campus Helpers',
  category: 'COLLEGE',
  type: 'COLLEGE',
  description: 'Verified campus help for students, staff, and nearby residents.',
  location: 'North Gate, Delhi',
  city: 'Delhi',
  state: 'Delhi',
  visibility: 'PUBLIC',
  joinPolicy: 'OPEN',
  memberCount: 44,
  membershipStatus: 'ACTIVE',
  currentUserRole: 'ADMIN',
};

export const phase7bUser = {
  id: 'u-current',
  userId: 'u-current',
  email: 'phase7b@example.com',
  fullName: 'Phase 7B Admin',
  token: 'phase7b-token',
  onboardingCompleted: true,
  role: 'USER',
};

export function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export async function usePhase7BSession(page) {
  await page.addInitScript((user) => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    window.localStorage.setItem('hvhn_token', user.token);
    window.localStorage.setItem('token', user.token);
    window.localStorage.setItem('hvhn_user', JSON.stringify(user));
    window.localStorage.setItem('hvhn_session_expiry', String(expiry));
  }, phase7bUser);
}

export async function mockPhase7BApi(page) {
  const members = [
    { id: 'm-current', userId: 'u-current', fullName: 'Phase 7B Admin', role: 'ADMIN', status: 'ACTIVE', joinedAt: '2026-08-01T10:00:00Z' },
    { id: 'm-helper', userId: 'u-helper', fullName: 'Other Helper', role: 'MEMBER', status: 'ACTIVE', joinedAt: '2026-08-03T10:00:00Z' },
    { id: 'm-owner', userId: 'u-owner', fullName: 'Owner Person', role: 'OWNER', status: 'ACTIVE', joinedAt: '2026-07-21T10:00:00Z' },
  ];
  const questions = [{
    id: 'q1',
    title: 'Where should new volunteers meet?',
    body: 'We need a consistent pickup point for evening coordination.',
    authorName: 'Phase 7B Admin',
    userId: 'u-current',
    upvoteCount: 4,
    answerCount: 1,
    answers: [{ id: 'a1', body: 'Use the library desk near Gate 2.', authorName: 'Other Helper', upvoteCount: 2 }],
  }];
  const campaigns = [{ id: 'camp1', title: 'Food packet drive', story: 'Pledge and coordinate dry ration packets for families nearby.', category: 'FOOD_DRIVE', status: 'ACTIVE', contributionCount: 8, targetAmount: 100, collectedAmount: 52 }];
  const announcements = [{ id: 'ann1', title: 'Coordination desk open', body: 'Desk volunteers are available from 5 PM.', pinned: true, createdAt: '2026-08-10T10:00:00Z' }];
  const requests = [{ id: 'r1', title: 'Need textbooks', description: 'Class 8 textbooks needed before Monday.', status: 'OPEN', requesterName: 'Student Desk' }];

  await page.route('**/api/users/me', async (route) => route.fulfill({ status: 200, json: phase7bUser }));

  await page.route('**/api/communities**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (method !== 'GET') return route.fulfill({ status: 200, json: { message: 'ok' } });
    if (pathname.endsWith('/dashboard')) return route.fulfill({ status: 200, json: { memberCount: 44, activeRequestCount: 7, openQuestionCount: 3, activeCampaignCount: 2 } });
    if (pathname.endsWith('/members')) return route.fulfill({ status: 200, json: members });
    if (pathname.endsWith('/requests')) return route.fulfill({ status: 200, json: requests });
    if (pathname.endsWith('/questions')) return route.fulfill({ status: 200, json: questions });
    if (pathname.endsWith('/campaigns')) return route.fulfill({ status: 200, json: campaigns });
    if (pathname.endsWith('/announcements')) return route.fulfill({ status: 200, json: announcements });
    if (pathname.match(/\/communities\/[^/]+$/)) return route.fulfill({ status: 200, json: community });
    return route.fulfill({ status: 200, json: [community, { ...community, id: 'c2', name: 'Green Valley Residents', visibility: 'PRIVATE', joinPolicy: 'APPROVAL_REQUIRED', membershipStatus: 'PENDING', currentUserRole: null }] });
  });
}

export async function stabilizePage(page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; scroll-behavior: auto !important; }',
  });
}

export async function screenshot(page, fileName) {
  ensureEvidenceDir();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, fileName), fullPage: true });
}

export async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
}

export async function runAxe(page) {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  }));
}
