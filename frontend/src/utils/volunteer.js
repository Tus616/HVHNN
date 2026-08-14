export const VOLUNTEER_CATEGORY_OPTIONS = [
  { value: 'BLOOD_DONATION', label: 'Blood Donation', icon: 'BD' },
  { value: 'MEDICAL', label: 'Medical', icon: 'MD' },
  { value: 'FOOD', label: 'Food', icon: 'FD' },
  { value: 'TRANSPORT', label: 'Transport', icon: 'TR' },
  { value: 'EMERGENCY', label: 'Emergency', icon: 'ER' },
  { value: 'GENERAL', label: 'General', icon: 'GN' },
];

export const VOLUNTEER_SKILL_OPTIONS = [
  { value: 'DOCTOR', label: 'Doctor', icon: 'DR' },
  { value: 'NURSE', label: 'Nurse', icon: 'NR' },
  { value: 'DRIVER', label: 'Driver', icon: 'DV' },
  { value: 'PHARMACIST', label: 'Pharmacist', icon: 'RX' },
  { value: 'COOK', label: 'Cook', icon: 'CK' },
  { value: 'COUNSELOR', label: 'Counselor', icon: 'CS' },
  { value: 'FIRST_AID', label: 'First Aid', icon: 'FA' },
  { value: 'GENERAL', label: 'General Volunteer', icon: 'GN' },
];

export const VOLUNTEER_BADGE_DEFS = [
  { key: 'helper', label: 'Helper', icon: 'H1', threshold: 1 },
  { key: 'rising-star', label: 'Rising Star', icon: 'H5', threshold: 5 },
  { key: 'active-volunteer', label: 'Active Volunteer', icon: 'H20', threshold: 20 },
  { key: 'community-hero', label: 'Community Hero', icon: 'H50', threshold: 50 },
];

const LEGACY_VOLUNTEER_CATEGORY_MAP = {
  BLOOD: 'BLOOD_DONATION',
  MEDICAL_EMERGENCY: 'MEDICAL',
  FOOD_SUPPORT: 'FOOD',
  DRIVER: 'TRANSPORT',
  SOS: 'EMERGENCY',
  CRITICAL: 'EMERGENCY',
  OTHER: 'GENERAL',
};

export function normalizeVolunteerCategory(category = '') {
  const normalized = String(category || '').trim().toUpperCase().replace(/[-\s]+/g, '_');
  return LEGACY_VOLUNTEER_CATEGORY_MAP[normalized] || normalized;
}

export function normalizeVolunteerCategories(categories = []) {
  const allowed = new Set(VOLUNTEER_CATEGORY_OPTIONS.map((category) => category.value));
  return [...new Set((Array.isArray(categories) ? categories : [])
    .map(normalizeVolunteerCategory)
    .filter((category) => allowed.has(category)))];
}

export function getVolunteerBadges(totalHelpCount = 0) {
  return VOLUNTEER_BADGE_DEFS.filter((badge) => totalHelpCount >= badge.threshold);
}

export function getPrimaryVolunteerBadge(totalHelpCount = 0) {
  const badges = getVolunteerBadges(totalHelpCount);
  return badges[badges.length - 1] || null;
}

export function mapRequestCategoryToVolunteerCategory(category = '') {
  const normalized = String(category || '').trim().toUpperCase();
  if (normalized.includes('BLOOD')) return 'BLOOD_DONATION';
  if (normalized.includes('MEDICAL')) return 'MEDICAL';
  if (normalized.includes('FOOD')) return 'FOOD';
  if (normalized.includes('TRANSPORT')) return 'TRANSPORT';
  if (normalized.includes('EMERGENCY') || normalized.includes('CRITICAL')) return 'EMERGENCY';
  return 'GENERAL';
}

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((value) => value == null || Number.isNaN(Number(value)))) {
    return null;
  }

  const earthRadiusKm = 6371;
  const latitudeDistance = toRadians(lat2 - lat1);
  const longitudeDistance = toRadians(lon2 - lon1);
  const latitudeA = toRadians(lat1);
  const latitudeB = toRadians(lat2);

  const haversine = Math.sin(latitudeDistance / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDistance / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * centralAngle;
}

export function formatDistance(distanceKm) {
  if (distanceKm == null || Number.isNaN(Number(distanceKm))) return 'Distance unavailable';
  return `${Number(distanceKm).toFixed(distanceKm < 10 ? 1 : 0)} km away`;
}

export function formatVolunteerProgressStatus(status = '') {
  if (!status) return 'Awaiting volunteer update';
  return String(status)
    .trim()
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function isVolunteerRequestActive(request) {
  return ['ACTIVE', 'ACCEPTED', 'IN_PROGRESS'].includes(request?.status);
}

function toRadians(value) {
  return value * (Math.PI / 180);
}
