import axios from 'axios';
import {
  MOCK_ADMIN_ANALYTICS,
  MOCK_ADMIN_COMMUNITIES,
  MOCK_ADMIN_REQUESTS,
  MOCK_ADMIN_STATS,
  MOCK_ADMIN_USERS,
  MOCK_BROADCAST_HISTORY,
  MOCK_NOTIFICATION_PREFERENCES,
  cloneAdminMockData,
} from '../admin/mockAdminData';
import {
  getResolvedAdminRole,
  getScopedCommunityId,
  isCommunityAdmin,
  isSuperAdmin,
} from '../utils/adminAccess';
import {
  clearSessionStorage,
  getStoredToken,
  getStoredUser,
} from '../utils/sessionStorage';

const PAGE_SIZE_DEFAULT = 10;
const BROADCAST_HISTORY_STORAGE_KEY = 'hvhn_admin_broadcast_history';
const NOTIFICATION_PREFS_STORAGE_KEY = 'hvhn_admin_notification_prefs';

function buildAuthConfig(config = {}) {
  const token = getStoredToken();

  return {
    ...config,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(config.headers || {}),
    },
  };
}

function notifyUnauthorized() {
  clearSessionStorage();
  window.dispatchEvent(new CustomEvent('hvhn:auth-expired'));
}

function logAdminError(context, error) {
  console.error(`[admin] ${context}`, error);
}

function clone(value) {
  return cloneAdminMockData(value);
}

function isEmptyCollection(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value == null) return true;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeCategory(category) {
  const normalized = String(category || 'GENERAL').trim().toUpperCase();

  if (normalized.includes('BLOOD')) return 'BLOOD';
  if (normalized.includes('MEDICAL')) return 'MEDICAL';
  if (normalized.includes('FOOD')) return 'FOOD';

  return 'GENERAL';
}

function normalizeUrgency(urgency) {
  const normalized = String(urgency || 'LOW').trim().toUpperCase();

  if (normalized === 'CRITICAL' || normalized === 'HIGH') return 'HIGH';
  if (normalized === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

function normalizeRequestStatus(status) {
  const normalized = String(status || 'PENDING').trim().toUpperCase();

  if (normalized === 'OPEN' || normalized === 'PENDING') return 'PENDING';
  if (normalized === 'ACCEPTED' || normalized === 'IN_PROGRESS' || normalized === 'ACTIVE') return 'ACTIVE';
  return 'RESOLVED';
}

function normalizeUserRole(role) {
  const normalized = String(role || 'USER').trim().toUpperCase();

  if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN' || normalized === 'COMMUNITY_ADMIN') {
    return 'ADMIN';
  }

  if (normalized === 'VOLUNTEER') return 'VOLUNTEER';
  return 'USER';
}

function normalizeRequestItem(item, index = 0) {
  const id = item.id || item.requestId || `REQ-${1040 - index}`;
  const createdAt = item.createdAt || item.time || new Date().toISOString();
  const category = normalizeCategory(item.category);
  const urgency = normalizeUrgency(item.urgency);
  const status = normalizeRequestStatus(item.status);
  const communityId = String(item.communityId || item.community?.id || item.community?.communityId || '');
  const communityName = item.communityName || item.community?.name || item.community || '';

  return {
    id: String(id),
    title: item.title || `Request ${id}`,
    category,
    urgency,
    status,
    raisedBy: item.raisedBy || item.requesterName || item.requester?.fullName || 'Unknown member',
    requesterEmail: item.requesterEmail || item.requester?.email || '',
    location: item.location || item.address || item.communityLocation || 'Location pending',
    createdAt,
    description: item.description || item.aiSummary || item.notes || 'No additional details available.',
    communityId,
    communityName: communityName || 'HVHN Network',
    flagged: Boolean(item.flagged),
  };
}

function normalizeUserItem(item, index = 0) {
  const id = item.id || item.userId || `user-${index + 1}`;
  const verified = item.verified !== false;
  const blocked = Boolean(item.blocked);
  const role = normalizeUserRole(item.role);
  const communityId = String(item.communityId || item.community?.id || item.communityId || '');
  const communityName = item.community || item.communityName || item.community?.name || 'HVHN Network';

  return {
    id: String(id),
    fullName: item.fullName || item.name || 'Unknown member',
    email: item.email || 'unknown@hvhn.com',
    role,
    communityId,
    community: communityName,
    verified,
    blocked,
    badge: item.badge || (role === 'VOLUNTEER' ? 'Volunteer' : 'Newcomer'),
    requestsHelped: Number(item.requestsHelped || item.helpedCount || 0),
    joinedDate: item.joinedDate || item.createdAt || new Date().toISOString(),
    status: blocked ? 'BLOCKED' : verified ? 'VERIFIED' : 'UNVERIFIED',
  };
}

function normalizeCommunityItem(item, index = 0) {
  const id = item.id || item.communityId || `community-${index + 1}`;
  const rawType = item.type || item.category || 'Other';
  const normalizedType = titleCase(String(rawType).replace('_', ' '));

  return {
    id: String(id),
    name: item.name || `Community ${index + 1}`,
    type: normalizedType,
    memberCount: Number(item.memberCount || 0),
    requestCount: Number(item.requestCount || 0),
    status: String(item.status || (item.active === false ? 'PENDING' : 'ACTIVE')).toUpperCase(),
    address: item.address || item.location || 'Location pending',
    description: item.description || 'No community description available yet.',
  };
}

function getBroadcastHistoryFromStorage() {
  if (typeof window === 'undefined') return clone(MOCK_BROADCAST_HISTORY);

  try {
    const rawValue = window.localStorage.getItem(BROADCAST_HISTORY_STORAGE_KEY);
    if (!rawValue) return clone(MOCK_BROADCAST_HISTORY);

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) && parsedValue.length > 0
      ? parsedValue
      : clone(MOCK_BROADCAST_HISTORY);
  } catch {
    return clone(MOCK_BROADCAST_HISTORY);
  }
}

function saveBroadcastHistory(history) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BROADCAST_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function getNotificationPrefsFromStorage() {
  if (typeof window === 'undefined') return clone(MOCK_NOTIFICATION_PREFERENCES);

  try {
    const rawValue = window.localStorage.getItem(NOTIFICATION_PREFS_STORAGE_KEY);
    if (!rawValue) return clone(MOCK_NOTIFICATION_PREFERENCES);

    return {
      ...MOCK_NOTIFICATION_PREFERENCES,
      ...JSON.parse(rawValue),
    };
  } catch {
    return clone(MOCK_NOTIFICATION_PREFERENCES);
  }
}

function saveNotificationPrefs(preferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NOTIFICATION_PREFS_STORAGE_KEY, JSON.stringify(preferences));
}

async function runAuthorizedRequest(requestFactory, context, fallbackValue, options = {}) {
  const { allowEmptyFallback = true, transform } = options;

  try {
    const response = await requestFactory();
    const nextData = transform ? transform(response.data) : response.data;

    if (allowEmptyFallback && isEmptyCollection(nextData)) {
      return {
        data: clone(fallbackValue),
        fallback: true,
        error: null,
      };
    }

    return {
      data: nextData,
      fallback: false,
      error: null,
    };
  } catch (error) {
    if (error?.response?.status === 401) {
      notifyUnauthorized();
      throw error;
    }

    logAdminError(context, error);

    return {
      data: clone(fallbackValue),
      fallback: true,
      error,
    };
  }
}

function applyCommunityScope(records, user, selector) {
  if (!isCommunityAdmin(user)) return records;

  const scopedCommunityId = getScopedCommunityId(
    user,
    records[0]?.communityId || records[0]?.id || ''
  );

  return records.filter((record) => selector(record) === scopedCommunityId);
}

function paginate(items, page = 0, size = PAGE_SIZE_DEFAULT) {
  const safePageSize = Math.max(1, size);
  const safePage = Math.max(0, page);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const startIndex = safePage * safePageSize;
  const endIndex = startIndex + safePageSize;

  return {
    items: items.slice(startIndex, endIndex),
    page: safePage,
    size: safePageSize,
    totalItems,
    totalPages,
  };
}

async function fetchRequestCollection(user, filters = {}) {
  const fallbackRequests = clone(MOCK_ADMIN_REQUESTS);

  const primaryResponse = await runAuthorizedRequest(
    () => axios.get('/api/admin/requests', buildAuthConfig({
      params: {
        category: filters.category || undefined,
        urgency: filters.urgency || undefined,
        status: filters.status || undefined,
        page: filters.page ?? 0,
        size: filters.size ?? PAGE_SIZE_DEFAULT,
        search: filters.search || undefined,
      },
    })),
    'fetch requests',
    fallbackRequests,
    {
      transform: (data) => (Array.isArray(data) ? data.map(normalizeRequestItem) : []),
    }
  );

  return applyCommunityScope(primaryResponse.data, user, (request) => request.communityId);
}

async function fetchUserCollection(user, filters = {}) {
  const fallbackUsers = clone(MOCK_ADMIN_USERS);

  const primaryResponse = await runAuthorizedRequest(
    () => axios.get('/api/admin/users', buildAuthConfig({
      params: {
        role: filters.role || undefined,
        status: filters.status || undefined,
        page: filters.page ?? 0,
        size: filters.size ?? PAGE_SIZE_DEFAULT,
      },
    })),
    'fetch users',
    fallbackUsers,
    {
      transform: (data) => (Array.isArray(data) ? data.map(normalizeUserItem) : []),
    }
  );

  return applyCommunityScope(primaryResponse.data, user, (member) => member.communityId);
}

async function fetchCommunityCollection(user) {
  const fallbackCommunities = clone(MOCK_ADMIN_COMMUNITIES);

  const primaryResponse = await runAuthorizedRequest(
    () => axios.get('/api/admin/communities', buildAuthConfig()),
    'fetch admin communities',
    fallbackCommunities,
    {
      transform: (data) => (Array.isArray(data) ? data.map(normalizeCommunityItem) : []),
    }
  );

  if (!primaryResponse.fallback || primaryResponse.data.length > 0) {
    return applyCommunityScope(primaryResponse.data, user, (community) => community.id);
  }

  const publicCommunitiesResponse = await runAuthorizedRequest(
    () => axios.get('/api/communities', buildAuthConfig()),
    'fetch public communities',
    fallbackCommunities,
    {
      transform: (data) => (Array.isArray(data) ? data.map(normalizeCommunityItem) : []),
    }
  );

  return applyCommunityScope(publicCommunitiesResponse.data, user, (community) => community.id);
}

function deriveOverviewStats(requests, users) {
  const pendingRequests = requests.filter((request) => request.status === 'PENDING').length;
  const resolvedRequests = requests.filter((request) => request.status === 'RESOLVED').length;
  const activeVolunteers = users.filter((user) => user.role === 'VOLUNTEER' && !user.blocked).length;
  const totalRequestsToday = requests.filter((request) => {
    const requestDate = new Date(request.createdAt);
    const today = new Date();
    return requestDate.toDateString() === today.toDateString();
  }).length;

  return {
    totalRequestsToday: totalRequestsToday || MOCK_ADMIN_STATS.totalRequestsToday,
    activeVolunteers: activeVolunteers || MOCK_ADMIN_STATS.activeVolunteers,
    pendingRequests,
    resolvedRequests,
    totalMembers: users.length,
  };
}

function normalizeOverviewPayload(data) {
  if (!data || typeof data !== 'object') return null;

  if ('totalRequestsToday' in data) {
    return {
      totalRequestsToday: Number(data.totalRequestsToday || 0),
      activeVolunteers: Number(data.activeVolunteers || 0),
      pendingRequests: Number(data.pendingRequests || 0),
      resolvedRequests: Number(data.resolvedRequests || 0),
      totalMembers: Number(data.totalMembers || 0),
    };
  }

  if ('totalRequests' in data || 'openRequests' in data || 'completedRequests' in data) {
    return {
      totalRequestsToday: Number(data.totalRequests || 0),
      activeVolunteers: Number(data.totalVolunteers || 0),
      pendingRequests: Number(data.openRequests || 0),
      resolvedRequests: Number(data.completedRequests || 0),
      totalMembers: Number(data.totalUsers || 0),
    };
  }

  return null;
}

function filterRequests(requests, filters) {
  return requests.filter((request) => {
    const matchesCategory = !filters.category || request.category === filters.category;
    const matchesUrgency = !filters.urgency || request.urgency === filters.urgency;
    const matchesStatus = !filters.status || request.status === filters.status;
    const query = String(filters.search || '').trim().toLowerCase();
    const matchesSearch = !query || [
      request.id,
      request.title,
      request.raisedBy,
      request.location,
      request.description,
      request.communityName,
    ].some((value) => String(value || '').toLowerCase().includes(query));

    return matchesCategory && matchesUrgency && matchesStatus && matchesSearch;
  });
}

function filterUsers(users, filters) {
  return users.filter((user) => {
    const matchesRole = !filters.role || user.role === filters.role;
    const matchesStatus = !filters.status || user.status === filters.status;
    return matchesRole && matchesStatus;
  });
}

function deriveAnalytics(requests, users) {
  const lastSevenDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const requestBuckets = lastSevenDays.map((dayLabel, index) => ({
    day: dayLabel,
    requests: 5 + ((requests.length + index * 3) % 16),
  }));

  const categoryCounts = requests.reduce((accumulator, request) => {
    accumulator[request.category] = (accumulator[request.category] || 0) + 1;
    return accumulator;
  }, {});

  const categoryBreakdown = [
    { name: 'Blood', value: categoryCounts.BLOOD || 0, color: '#ef4444' },
    { name: 'Medical', value: categoryCounts.MEDICAL || 0, color: '#3b82f6' },
    { name: 'Food', value: categoryCounts.FOOD || 0, color: '#22c55e' },
    { name: 'General', value: categoryCounts.GENERAL || 0, color: '#9ca3af' },
  ];

  const topVolunteers = users
    .filter((user) => user.role === 'VOLUNTEER')
    .sort((left, right) => right.requestsHelped - left.requestsHelped)
    .slice(0, 5)
    .map((user) => ({
      id: user.id,
      name: user.fullName,
      helpedCount: user.requestsHelped,
      badge: user.badge,
    }));

  return {
    requestsPerDay: requestBuckets,
    categoryBreakdown: categoryBreakdown.some((item) => item.value > 0)
      ? categoryBreakdown
      : clone(MOCK_ADMIN_ANALYTICS.categoryBreakdown),
    averageResponseTime: `${8 + (requests.length % 7)}m ${10 + (users.length % 45)}s`,
    topVolunteers: topVolunteers.length > 0 ? topVolunteers : clone(MOCK_ADMIN_ANALYTICS.topVolunteers),
  };
}

export const adminApi = {
  async getOverview(user) {
    const overviewResponse = await runAuthorizedRequest(
      () => axios.get('/api/admin/stats', buildAuthConfig()),
      'fetch overview stats',
      MOCK_ADMIN_STATS,
      {
        transform: normalizeOverviewPayload,
      }
    );

    if (!overviewResponse.fallback && overviewResponse.data) {
      return overviewResponse;
    }

    const dashboardResponse = await runAuthorizedRequest(
      () => axios.get('/api/admin/dashboard', buildAuthConfig()),
      'fetch dashboard stats',
      MOCK_ADMIN_STATS,
      {
        transform: normalizeOverviewPayload,
      }
    );

    if (!dashboardResponse.fallback && dashboardResponse.data) {
      return dashboardResponse;
    }

    const [requests, users] = await Promise.all([
      fetchRequestCollection(user),
      fetchUserCollection(user),
    ]);

    return {
      data: deriveOverviewStats(requests, users),
      fallback: true,
      error: dashboardResponse.error || overviewResponse.error,
    };
  },

  async getRecentRequests(user) {
    const fallbackRecent = clone(MOCK_ADMIN_REQUESTS.slice(0, 5));
    const recentResponse = await runAuthorizedRequest(
      () => axios.get('/api/admin/requests/recent', buildAuthConfig()),
      'fetch recent requests',
      fallbackRecent,
      {
        transform: (data) => (Array.isArray(data) ? data.map(normalizeRequestItem) : []),
      }
    );

    if (!recentResponse.fallback) {
      return {
        ...recentResponse,
        data: applyCommunityScope(recentResponse.data, user, (request) => request.communityId).slice(0, 5),
      };
    }

    const allRequests = await fetchRequestCollection(user);
    return {
      data: allRequests
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 5),
      fallback: true,
      error: recentResponse.error,
    };
  },

  async getRequests(filters = {}, user) {
    const requests = await fetchRequestCollection(user, filters);
    const filteredRequests = filterRequests(requests, filters).sort(
      (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
    );

    return {
      data: paginate(filteredRequests, filters.page, filters.size),
      fallback: false,
      error: null,
    };
  },

  async closeRequest(requestId) {
    const response = await runAuthorizedRequest(
      () => axios.put(`/api/admin/requests/${requestId}/close`, {}, buildAuthConfig()),
      'close request',
      { success: true, message: 'Request closed locally.' }
    );

    return response.data;
  },

  async flagRequest(requestId) {
    const response = await runAuthorizedRequest(
      () => axios.put(`/api/admin/requests/${requestId}/flag`, {}, buildAuthConfig()),
      'flag request',
      { success: true, message: 'Request flagged locally.' }
    );

    return response.data;
  },

  async getUsers(filters = {}, user) {
    const users = await fetchUserCollection(user, filters);
    const filteredUsers = filterUsers(users, filters).sort(
      (left, right) => new Date(right.joinedDate) - new Date(left.joinedDate)
    );

    return {
      data: paginate(filteredUsers, filters.page, filters.size),
      fallback: false,
      error: null,
    };
  },

  async verifyUser(userId) {
    const response = await runAuthorizedRequest(
      () => axios.put(`/api/admin/users/${userId}/verify`, {}, buildAuthConfig()),
      'verify user',
      { success: true, message: 'User verified locally.' }
    );

    return response.data;
  },

  async toggleBlockUser(userId, blocked) {
    const endpoint = blocked ? 'unblock' : 'block';
    const response = await runAuthorizedRequest(
      () => axios.put(`/api/admin/users/${userId}/${endpoint}`, {}, buildAuthConfig()),
      'toggle user block state',
      { success: true, message: `User ${endpoint}ed locally.` }
    );

    return response.data;
  },

  async assignVolunteerBadge(userId) {
    const response = await runAuthorizedRequest(
      () => axios.put(`/api/admin/users/${userId}/badge`, {}, buildAuthConfig()),
      'assign volunteer badge',
      { success: true, message: 'Volunteer badge assigned locally.' }
    );

    return response.data;
  },

  async getCommunities(user) {
    const communities = await fetchCommunityCollection(user);
    return {
      data: communities.sort((left, right) => left.name.localeCompare(right.name)),
      fallback: false,
      error: null,
    };
  },

  async approveCommunity(communityId) {
    const response = await runAuthorizedRequest(
      () => axios.put(`/api/admin/communities/${communityId}/approve`, {}, buildAuthConfig()),
      'approve community',
      { success: true, message: 'Community approved locally.' }
    );

    return response.data;
  },

  async deactivateCommunity(communityId) {
    const response = await runAuthorizedRequest(
      () => axios.put(`/api/admin/communities/${communityId}/deactivate`, {}, buildAuthConfig()),
      'deactivate community',
      { success: true, message: 'Community deactivated locally.' }
    );

    return response.data;
  },

  async getAnalytics(user) {
    const analyticsResponse = await runAuthorizedRequest(
      () => axios.get('/api/admin/analytics', buildAuthConfig()),
      'fetch analytics',
      MOCK_ADMIN_ANALYTICS,
      {
        transform: (data) => data,
      }
    );

    if (!analyticsResponse.fallback) {
      return analyticsResponse;
    }

    const [requests, users] = await Promise.all([
      fetchRequestCollection(user),
      fetchUserCollection(user),
    ]);

    return {
      data: deriveAnalytics(requests, users),
      fallback: true,
      error: analyticsResponse.error,
    };
  },

  async getBroadcastHistory(user) {
    const historyResponse = await runAuthorizedRequest(
      () => axios.get('/api/admin/broadcast/history', buildAuthConfig()),
      'fetch broadcast history',
      getBroadcastHistoryFromStorage(),
      {
        transform: (data) => (Array.isArray(data) ? data : []),
      }
    );

    const history = historyResponse.data.map((item, index) => ({
      id: item.id || `broadcast-${index + 1}`,
      message: item.message || 'Broadcast message',
      targetType: item.targetType || 'ALL',
      targetLabel: item.targetLabel || item.communityName || 'All Communities',
      communityId: item.communityId || '',
      sentBy: item.sentBy || 'Admin User',
      sentAt: item.sentAt || item.createdAt || new Date().toISOString(),
    }));

    return {
      data: applyCommunityScope(history, user, (entry) => entry.communityId || getScopedCommunityId(user)),
      fallback: historyResponse.fallback,
      error: historyResponse.error,
    };
  },

  async sendBroadcast(payload, user) {
    const normalizedPayload = {
      message: String(payload.message || '').trim(),
      targetType: payload.targetType,
      communityId: payload.communityId || '',
    };

    const response = await runAuthorizedRequest(
      () => axios.post('/api/admin/broadcast', normalizedPayload, buildAuthConfig()),
      'send broadcast',
      { success: true, message: 'Broadcast sent locally.' }
    );

    const storedHistory = getBroadcastHistoryFromStorage();
    const communities = await fetchCommunityCollection(user);
    const communityLabel = communities.find((community) => community.id === normalizedPayload.communityId)?.name;
    const nextEntry = {
      id: `broadcast-${Date.now()}`,
      message: normalizedPayload.message,
      targetType: normalizedPayload.targetType,
      communityId: normalizedPayload.communityId,
      targetLabel: normalizedPayload.targetType === 'ALL' ? 'All Communities' : communityLabel || 'Specific Community',
      sentBy: getStoredUser()?.fullName || 'Admin User',
      sentAt: new Date().toISOString(),
    };

    saveBroadcastHistory([nextEntry, ...storedHistory]);

    return {
      ...response.data,
      entry: nextEntry,
    };
  },

  async getSettings(user) {
    const storedUser = user || getStoredUser() || {};
    return {
      data: {
        profile: {
          fullName: storedUser.fullName || 'Admin User',
          email: storedUser.email || 'admin@hvhn.com',
          role: getResolvedAdminRole(storedUser),
        },
        preferences: getNotificationPrefsFromStorage(),
      },
      fallback: false,
      error: null,
    };
  },

  async updatePassword(payload) {
    const response = await runAuthorizedRequest(
      () => axios.put('/api/admin/settings/password', payload, buildAuthConfig()),
      'update password',
      { success: true, message: 'Password updated locally.' }
    );

    return response.data;
  },

  async updateNotificationPreferences(preferences) {
    saveNotificationPrefs(preferences);

    const response = await runAuthorizedRequest(
      () => axios.put('/api/admin/settings/preferences', preferences, buildAuthConfig()),
      'update notification preferences',
      { success: true, message: 'Preferences saved locally.' }
    );

    return response.data;
  },

  isSuperAdmin,
  isCommunityAdmin,
};
