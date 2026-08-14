const SESSION_KEYS = [
  'hvhn_token',
  'token',
  'hvhn_user',
  'role',
  'communityId',
  'hvhn_session_expiry',
  'hvhn_profile_setup_complete',
];

export function clearSessionStorage() {
  if (typeof window === 'undefined') return;

  SESSION_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

export function getStoredToken() {
  if (typeof window === 'undefined') return '';

  return (
    window.localStorage.getItem('hvhn_token')
    || window.localStorage.getItem('token')
    || ''
  );
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;

  try {
    const rawUser = window.localStorage.getItem('hvhn_user');
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export function parseJwtPayload(token) {
  if (!token || typeof window === 'undefined') return null;

  try {
    const [, encodedPayload] = token.split('.');
    if (!encodedPayload) return null;

    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '='
    );

    return JSON.parse(window.atob(paddedPayload));
  } catch {
    return null;
  }
}

export function getStoredRole() {
  if (typeof window === 'undefined') return '';

  return (
    window.localStorage.getItem('role')
    || parseJwtPayload(getStoredToken())?.role
    || getStoredUser()?.role
    || ''
  );
}

export function persistSessionStorage(userData, token, expiry) {
  if (typeof window === 'undefined') return;

  if (token) {
    window.localStorage.setItem('hvhn_token', token);
    window.localStorage.setItem('token', token);
  }

  if (userData) {
    window.localStorage.setItem('hvhn_user', JSON.stringify(userData));

    if (userData.role) {
      window.localStorage.setItem('role', userData.role);
    }

    if (userData.communityId) {
      window.localStorage.setItem('communityId', String(userData.communityId));
    }
  }

  if (expiry) {
    window.localStorage.setItem('hvhn_session_expiry', String(expiry));
  }
}
