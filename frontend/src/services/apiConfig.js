const DEFAULT_DEV_API_URL = '/api';
const viteEnv = import.meta.env || { DEV: true };

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

export function normalizeApiBaseUrl(value) {
  if (isBlank(value)) return '';
  let normalized = String(value).trim().replace(/\/+$/, '');
  if (!/\/api$/i.test(normalized)) {
    normalized = `${normalized}/api`;
  }
  return normalized;
}

export function resolveApiBaseUrl({
  runtimeConfig = typeof window !== 'undefined' ? window.__HVHN_CONFIG__ : {},
  env = viteEnv,
} = {}) {
  const runtimeUrl = runtimeConfig?.API_URL;
  const envUrl = env?.VITE_API_URL;
  const isDev = Boolean(env?.DEV);

  const candidate = !isBlank(runtimeUrl)
    ? runtimeUrl
    : !isBlank(envUrl)
      ? envUrl
      : isDev
        ? DEFAULT_DEV_API_URL
        : '';

  const resolved = normalizeApiBaseUrl(candidate);
  if (!resolved) {
    throw new Error('Missing backend API URL. Set window.__HVHN_CONFIG__.API_URL or VITE_API_URL for production builds.');
  }

  if (!/^https?:\/\//i.test(resolved) && resolved !== '/api') {
    throw new Error(`Invalid backend API URL: ${resolved}`);
  }

  return resolved;
}

export function resolveMockMode(env = viteEnv) {
  return Boolean(env?.DEV) && String(env?.VITE_USE_MOCK || '').toLowerCase() === 'true';
}

export function warnIfMockModeEnabled(enabled, logger = console) {
  if (enabled && viteEnv.DEV) {
    logger.warn('[Sahay] Mock API mode is enabled. Real backend API failures will not be hidden outside explicit mock calls.');
  }
}

export const API_BASE_URL = resolveApiBaseUrl();
export const USE_MOCK_API = resolveMockMode();

if (viteEnv.DEV) {
  console.info(`[Sahay] API base URL: ${API_BASE_URL}`);
  warnIfMockModeEnabled(USE_MOCK_API);
}
