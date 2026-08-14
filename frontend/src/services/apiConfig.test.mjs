import assert from 'node:assert/strict';
import { test } from 'node:test';

const moduleUrl = new URL('./apiConfig.js', import.meta.url);
const { normalizeApiBaseUrl, resolveApiBaseUrl, resolveMockMode } = await import(moduleUrl);

test('mock mode is disabled by default', () => {
  assert.equal(resolveMockMode({ DEV: true }), false);
  assert.equal(resolveMockMode({ DEV: false, VITE_USE_MOCK: 'true' }), false);
});

test('mock mode activates only in development when explicitly true', () => {
  assert.equal(resolveMockMode({ DEV: true, VITE_USE_MOCK: 'true' }), true);
  assert.equal(resolveMockMode({ DEV: true, VITE_USE_MOCK: 'false' }), false);
});

test('runtime API URL takes precedence over VITE_API_URL', () => {
  assert.equal(
    resolveApiBaseUrl({
      runtimeConfig: { API_URL: 'https://runtime.example.com/api/' },
      env: { DEV: true, VITE_API_URL: 'https://env.example.com/api' },
    }),
    'https://runtime.example.com/api'
  );
});

test('API URL is normalized with exactly one /api suffix', () => {
  assert.equal(normalizeApiBaseUrl('http://localhost:8080'), 'http://localhost:8080/api');
  assert.equal(normalizeApiBaseUrl('http://localhost:8080/api/'), 'http://localhost:8080/api');
});

test('production build fails visibly when API URL is missing', () => {
  assert.throws(
    () => resolveApiBaseUrl({ runtimeConfig: {}, env: { DEV: false } }),
    /Missing backend API URL/
  );
});
