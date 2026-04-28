import { getStoredRole, getStoredUser } from './sessionStorage';

export function normalizeAdminRole(rawRole) {
  const normalizedRole = String(rawRole || '')
    .trim()
    .replace(/^ROLE_/, '')
    .replace(/-/g, '_')
    .toUpperCase();

  if (normalizedRole === 'ADMIN') return 'SUPER_ADMIN';
  if (normalizedRole === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (normalizedRole === 'COMMUNITYADMIN') return 'COMMUNITY_ADMIN';

  return normalizedRole;
}

export function getResolvedAdminRole(user) {
  return normalizeAdminRole(user?.role || getStoredRole());
}

export function hasAdminAccess(user) {
  const role = getResolvedAdminRole(user);
  return role === 'SUPER_ADMIN' || role === 'COMMUNITY_ADMIN';
}

export function isSuperAdmin(user) {
  return getResolvedAdminRole(user) === 'SUPER_ADMIN';
}

export function isCommunityAdmin(user) {
  return getResolvedAdminRole(user) === 'COMMUNITY_ADMIN';
}

export function getScopedCommunityId(user, fallbackCommunityId = '') {
  if (typeof window === 'undefined') {
    return user?.communityId || fallbackCommunityId || '';
  }

  const storedUser = getStoredUser();

  return (
    window.localStorage.getItem('communityId')
    || user?.communityId
    || storedUser?.communityId
    || fallbackCommunityId
    || ''
  );
}
