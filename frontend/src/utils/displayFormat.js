import { VOLUNTEER_CATEGORY_OPTIONS } from './volunteer';

export function humanizeEnum(value, fallback = 'Unknown') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDateShort(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatLocation(profile = {}) {
  return [profile.address, profile.city, profile.district, profile.state, profile.postalCode]
    .filter(Boolean)
    .join(', ') || 'Location not set';
}

export function formatVolunteerCategory(value) {
  const option = VOLUNTEER_CATEGORY_OPTIONS.find((entry) => entry.value === value);
  return option?.label || humanizeEnum(value, 'General');
}

export function getFriendlyProvider(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('google')) return 'Google';
  if (normalized.includes('firebase')) return 'Email link';
  if (normalized.includes('password')) return 'Email and password';
  if (normalized.includes('email')) return 'Email';
  return value ? humanizeEnum(value) : 'Sahay account';
}
