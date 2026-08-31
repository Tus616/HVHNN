import axios from 'axios';
import { clearSessionStorage, getStoredToken } from '../utils/sessionStorage';
import {
  calculateDistanceKm,
  getPrimaryVolunteerBadge,
  getVolunteerBadges,
  mapRequestCategoryToVolunteerCategory,
} from '../utils/volunteer';
import { API_BASE_URL, USE_MOCK_API } from './apiConfig';

const USE_MOCK = USE_MOCK_API;
const USE_MOCK_AUTH = USE_MOCK_API && import.meta.env.VITE_USE_MOCK_AUTH === 'true';
const USE_MOCK_USERS = USE_MOCK_API && import.meta.env.VITE_USE_MOCK_USERS === 'true';

export const AUTH_USES_MOCK = USE_MOCK_AUTH;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

function isLikelyBackendUnavailable(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const requestUrl = error?.config?.url || '';

  if (!import.meta.env.DEV || status !== 500) return false;
  if (!requestUrl.startsWith('/')) return false;

  // Vite's dev proxy commonly returns a bare 500 when the backend target is down.
  return data == null || data === '';
}

function getFriendlyErrorMessage(error) {
  if (isLikelyBackendUnavailable(error)) {
    return 'Backend API is not reachable on http://localhost:8080. Start the Spring Boot backend, then try again.';
  }

  if (error?.response?.status === 503 && error?.config?.url === '/auth/firebase') {
    return 'Firebase verification is temporarily unavailable on the backend. Check the backend logs and try again.';
  }

  // Ensure we check for 'error' payload returned by Spring Boot Map.of("error", ...)
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Request failed.';
}

function isConfirmedSessionExpiry(error) {
  const status = error?.response?.status;
  const requestUrl = error?.config?.url || '';
  return status === 401 && requestUrl === '/users/me' && Boolean(getStoredToken());
}

api.interceptors.request.use(config => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (isConfirmedSessionExpiry(error)) {
      if (typeof window !== 'undefined') {
        clearSessionStorage();
        window.dispatchEvent(new CustomEvent('hvhn:auth-expired'));
      }
    }
    const message = getFriendlyErrorMessage(error);
    if (error) error.message = message;
    return Promise.reject(error);
  }
);

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getWithTransientRetry(url, config, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return config === undefined ? await api.get(url) : await api.get(url, config);
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 503 || attempt === attempts - 1) {
        throw error;
      }
      await wait(300 * (attempt + 1));
    }
  }
  throw lastError;
}

// ====== MOCK DATA ======
const mockCommunities = [
  { id: 1, name: 'IIT Delhi', type: 'COLLEGE', description: 'Indian Institute of Technology Delhi', address: 'Hauz Khas, New Delhi', memberCount: 150, active: true, verificationCode: 'IITD2026' },
  { id: 2, name: 'AIIMS Delhi', type: 'HOSPITAL', description: 'All India Institute of Medical Sciences', address: 'Ansari Nagar, New Delhi', memberCount: 200, active: true, verificationCode: 'AIIMS2026' },
  { id: 3, name: 'Green Valley Society', type: 'RESIDENTIAL', description: 'Residential society in Noida', address: 'Sector 62, Noida', memberCount: 80, active: true, verificationCode: 'GVS2026' },
];

// Track which communities each user has joined: { userId: [communityId, ...] }
const joinedCommunities = { 1: [1], 2: [2], 3: [3] };

let mockRequests = [
  {
    id: 1, title: 'Urgent: B+ Blood Needed', description: 'Patient in ICU needs B+ blood urgently. 3 units required. Contact ward number 5.',
    category: 'BLOOD_DONATION', urgency: 'CRITICAL', status: 'OPEN', address: 'AIIMS Delhi, Ward 5',
    latitude: 28.5672, longitude: 77.2100, contactPhone: '+91-9999000003',
    aiCategory: 'BLOOD_DONATION', aiUrgency: 'CRITICAL', aiSummary: 'AI Analysis: CRITICAL urgency blood donation request.',
    viewCount: 45, responseCount: 0, currentTier: 1,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    requester: { id: 2, fullName: 'Priya Patel', rating: 4.8 },
    community: { id: 2, name: 'AIIMS Delhi' }
  },
  {
    id: 2, title: 'Need Medicine Delivery', description: 'Elderly person needs diabetes medicine delivered from pharmacy. Cannot leave home due to mobility issues.',
    category: 'MEDICAL', urgency: 'HIGH', status: 'OPEN', address: 'Block A, Green Valley Society, Noida',
    latitude: 28.6270, longitude: 77.3649, contactPhone: '+91-9999000004',
    aiCategory: 'MEDICAL', aiUrgency: 'HIGH', aiSummary: 'AI Analysis: HIGH urgency medical request.',
    viewCount: 22, responseCount: 0, currentTier: 1,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    requester: { id: 3, fullName: 'Amit Kumar', rating: 4.5 },
    community: { id: 3, name: 'Green Valley Society' }
  },
  {
    id: 3, title: 'Food packets for flood-affected families', description: '10 families displaced due to waterlogging need food packets. Can someone help with meal preparation or food supplies?',
    category: 'FOOD', urgency: 'HIGH', status: 'ACCEPTED', address: 'Near IIT Delhi Gate',
    latitude: 28.5459, longitude: 77.1926,
    aiCategory: 'FOOD', aiUrgency: 'HIGH', aiSummary: 'AI Analysis: HIGH urgency food request.',
    viewCount: 67, responseCount: 3, currentTier: 1,
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    acceptedAt: new Date(Date.now() - 7200000).toISOString(),
    requester: { id: 1, fullName: 'Rahul Sharma', rating: 4.6 },
    volunteer: { id: 2, fullName: 'Priya Patel', rating: 4.8 },
    community: { id: 1, name: 'IIT Delhi' }
  },
  {
    id: 4, title: 'Transport to hospital needed', description: 'Need a vehicle to transport injured person to hospital. Ambulance taking too long.',
    category: 'TRANSPORT', urgency: 'CRITICAL', status: 'COMPLETED', address: 'Connaught Place, New Delhi',
    latitude: 28.6139, longitude: 77.2090,
    aiCategory: 'TRANSPORT', aiUrgency: 'CRITICAL',
    viewCount: 120, responseCount: 5, currentTier: 2,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 72000000).toISOString(),
    requester: { id: 1, fullName: 'Rahul Sharma', rating: 4.6 },
    volunteer: { id: 3, fullName: 'Amit Kumar', rating: 4.5 },
  },
  {
    id: 5, title: 'Wheelchair needed for 3 days', description: 'My grandmother had a knee surgery and needs a wheelchair for recovery period. Can anyone lend one?',
    category: 'MEDICAL', urgency: 'MEDIUM', status: 'OPEN', address: 'Sector 15, Gurugram',
    latitude: 28.4595, longitude: 77.0266,
    aiCategory: 'MEDICAL', aiUrgency: 'MEDIUM', aiSummary: 'AI Analysis: MEDIUM urgency medical equipment request.',
    viewCount: 15, responseCount: 0, currentTier: 1,
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    requester: { id: 3, fullName: 'Amit Kumar', rating: 4.5 },
  },
  {
    id: 6, title: 'Emergency: Fire in Building', description: 'Small fire broke out in electrical room of Block C. Need fire extinguishers and people to help evacuate elderly residents.',
    category: 'EMERGENCY', urgency: 'CRITICAL', status: 'OPEN', address: 'Green Valley Society, Block C',
    latitude: 28.6275, longitude: 77.3655,
    aiCategory: 'EMERGENCY', aiUrgency: 'CRITICAL', aiSummary: 'AI Analysis: CRITICAL emergency. Fire safety response needed.',
    viewCount: 89, responseCount: 2, currentTier: 1,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    requester: { id: 3, fullName: 'Amit Kumar', rating: 4.5 },
    community: { id: 3, name: 'Green Valley Society' }
  },
];

const mockUsers = [
  { id: 1, fullName: 'Rahul Sharma', email: 'rahul@example.com', password: 'pass123', role: 'USER', points: 120, requestsHelped: 5, requestsCreated: 3, rating: 4.6, verified: true, badge: 'Helper', address: 'IIT Delhi Campus' },
  { id: 2, fullName: 'Priya Patel', email: 'priya@example.com', password: 'pass123', role: 'USER', points: 250, requestsHelped: 12, requestsCreated: 2, rating: 4.8, verified: true, badge: 'Champion', address: 'AIIMS Campus' },
  { id: 3, fullName: 'Amit Kumar', email: 'amit@example.com', password: 'pass123', role: 'USER', points: 75, requestsHelped: 3, requestsCreated: 4, rating: 4.5, verified: true, badge: 'Volunteer', address: 'Sector 62, Noida' },
  { id: 4, fullName: 'Admin User', email: 'admin@hvhn.com', password: 'admin123', role: 'ADMIN', points: 500, requestsHelped: 0, requestsCreated: 0, rating: 5.0, verified: true, badge: 'Hero', address: 'Central Delhi' },
  { id: 5, fullName: 'Sneha Gupta', email: 'sneha@example.com', password: 'pass123', role: 'USER', points: 180, requestsHelped: 8, requestsCreated: 1, rating: 4.9, verified: true, badge: 'Helper', address: 'Dwarka, Delhi' },
  { id: 6, fullName: 'Vikram Singh', email: 'vikram@example.com', password: 'pass123', role: 'USER', points: 310, requestsHelped: 15, requestsCreated: 5, rating: 4.7, verified: true, badge: 'Champion', address: 'Rohini, Delhi' },
];

const communityMemberDirectory = {
  1: [
    {
      id: 1,
      fullName: 'Rahul Sharma',
      email: 'rahul@example.com',
      verified: true,
      points: 120,
      requestsHelped: 5,
      rating: 4.6,
      address: 'IIT Delhi Campus',
      roleLabel: 'Student Lead',
      title: 'Hostel volunteer coordinator',
      availability: 'Available now',
      responseTime: '~6 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      skills: ['Logistics', 'Transport', 'Night shifts'],
      languages: ['English', 'Hindi'],
      bio: 'Coordinates hostel volunteers for transport, late-night pickup runs, and campus support.',
      supportStyle: 'Fast logistics handoffs',
      trustScore: 91,
    },
    {
      id: 5,
      fullName: 'Sneha Gupta',
      email: 'sneha@example.com',
      verified: true,
      points: 180,
      requestsHelped: 8,
      rating: 4.9,
      address: 'South Campus',
      roleLabel: 'Wellness Lead',
      title: 'Food and comfort support',
      availability: 'Available in 20 min',
      responseTime: '~11 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
      skills: ['Meal prep', 'Essentials kits', 'Family coordination'],
      languages: ['English', 'Hindi'],
      bio: 'Steps in when a request needs calm coordination, food support, or repeated follow-ups.',
      supportStyle: 'High-empathy follow-through',
      trustScore: 95,
    },
    {
      id: 'iit-aarti',
      fullName: 'Aarti Mehra',
      email: 'aarti.mehra@iitd.ac.in',
      verified: true,
      points: 264,
      requestsHelped: 13,
      rating: 4.9,
      address: 'Faculty Housing, IIT Delhi',
      roleLabel: 'Faculty Advisor',
      title: 'Emergency response mentor',
      availability: 'On call',
      responseTime: '~9 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      skills: ['Crisis triage', 'Emergency planning', 'Volunteer routing'],
      languages: ['English', 'Hindi'],
      bio: 'Helps student responders turn urgent requests into clear action plans without confusion.',
      supportStyle: 'Structured escalation',
      trustScore: 97,
    },
    {
      id: 'iit-farhan',
      fullName: 'Farhan Ali',
      email: 'farhan.ali@alumni.iitd.ac.in',
      verified: true,
      points: 94,
      requestsHelped: 4,
      rating: 4.7,
      address: 'Hauz Khas Extension',
      roleLabel: 'Mobility Volunteer',
      title: 'Campus-to-hospital runner',
      availability: 'Available tonight',
      responseTime: '~14 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
      skills: ['Ride support', 'Pickup coordination', 'Medicine runs'],
      languages: ['English', 'Hindi', 'Urdu'],
      bio: 'Usually handles transport-heavy tasks and handoffs outside the campus gate.',
      supportStyle: 'Reliable field execution',
      trustScore: 88,
    },
  ],
  2: [
    {
      id: 2,
      fullName: 'Priya Patel',
      email: 'priya@example.com',
      verified: true,
      points: 250,
      requestsHelped: 12,
      rating: 4.8,
      address: 'AIIMS Campus',
      roleLabel: 'Ward Lead',
      title: 'Blood and patient support',
      availability: 'Available now',
      responseTime: '~5 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
      skills: ['Blood coordination', 'Patient attendants', 'Rapid updates'],
      languages: ['English', 'Hindi', 'Gujarati'],
      bio: 'Keeps ward-level requests moving quickly and helps connect attendants with volunteers.',
      supportStyle: 'Immediate bedside coordination',
      trustScore: 96,
    },
    {
      id: 'aiims-raghav',
      fullName: 'Dr. Raghav Menon',
      email: 'raghav.menon@aiims.edu',
      verified: true,
      points: 420,
      requestsHelped: 18,
      rating: 5.0,
      address: 'Ansari Nagar',
      roleLabel: 'Medical Lead',
      title: 'Clinical escalation advisor',
      availability: 'On call',
      responseTime: '~7 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      skills: ['Triage', 'Escalations', 'Hospital routing'],
      languages: ['English', 'Hindi', 'Malayalam'],
      bio: 'Supports volunteers with what to verify first when a request involves hospital movement.',
      supportStyle: 'Calm clinical direction',
      trustScore: 99,
    },
    {
      id: 'aiims-kavya',
      fullName: 'Kavya Bansal',
      email: 'kavya.bansal@aiims.edu',
      verified: true,
      points: 146,
      requestsHelped: 6,
      rating: 4.8,
      address: 'South Extension',
      roleLabel: 'Pharmacy Runner',
      title: 'Medicine and reports pickup',
      availability: 'Available in 15 min',
      responseTime: '~12 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
      skills: ['Medicine pickup', 'Report collection', 'Family updates'],
      languages: ['English', 'Hindi'],
      bio: 'Best for medicine pickups, diagnostic reports, and non-clinical hospital errands.',
      supportStyle: 'Fast completion loops',
      trustScore: 90,
    },
  ],
  3: [
    {
      id: 3,
      fullName: 'Amit Kumar',
      email: 'amit@example.com',
      verified: true,
      points: 75,
      requestsHelped: 3,
      rating: 4.5,
      address: 'Sector 62, Noida',
      roleLabel: 'Block Captain',
      title: 'Resident safety volunteer',
      availability: 'Available now',
      responseTime: '~9 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      skills: ['Resident outreach', 'Building safety', 'Supplies pickup'],
      languages: ['English', 'Hindi'],
      bio: 'Usually the first person to mobilize neighbors when a request comes from the society blocks.',
      supportStyle: 'Neighborhood coordination',
      trustScore: 86,
    },
    {
      id: 'gvs-neha',
      fullName: 'Neha Arora',
      email: 'neha.arora@gvs.com',
      verified: true,
      points: 132,
      requestsHelped: 7,
      rating: 4.9,
      address: 'Tower C, Green Valley Society',
      roleLabel: 'Community Care Lead',
      title: 'Family and elder support',
      availability: 'Available in 10 min',
      responseTime: '~8 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      skills: ['Elder care', 'Meal support', 'Emergency contacts'],
      languages: ['English', 'Hindi', 'Punjabi'],
      bio: 'Great first connect for family, elder-care, and society-level support requests.',
      supportStyle: 'Warm follow-through',
      trustScore: 94,
    },
    {
      id: 'gvs-abhishek',
      fullName: 'Abhishek Jain',
      email: 'abhishek.jain@gvs.com',
      verified: true,
      points: 88,
      requestsHelped: 5,
      rating: 4.7,
      address: 'Tower A, Green Valley Society',
      roleLabel: 'Transport Volunteer',
      title: 'Bike and cab coordination',
      availability: 'Available tonight',
      responseTime: '~13 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 41).toISOString(),
      skills: ['Ride support', 'Package pickup', 'Emergency errands'],
      languages: ['English', 'Hindi'],
      bio: 'Often helps with medicine delivery, quick pickups, and late-evening transport needs.',
      supportStyle: 'Quick field response',
      trustScore: 87,
    },
    {
      id: 'gvs-sana',
      fullName: 'Sana Khan',
      email: 'sana.khan@gvs.com',
      verified: true,
      points: 204,
      requestsHelped: 11,
      rating: 4.9,
      address: 'Tower B, Green Valley Society',
      roleLabel: 'Relief Organizer',
      title: 'Food and essentials distribution',
      availability: 'Available now',
      responseTime: '~7 min',
      lastActive: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
      skills: ['Food support', 'Volunteer scheduling', 'Bulk distribution'],
      languages: ['English', 'Hindi', 'Urdu'],
      bio: 'Helps break larger support requests into volunteer shifts and delivery runs.',
      supportStyle: 'High-volume coordination',
      trustScore: 93,
    },
  ],
};

let nextId = 7;
let mockRequestVolunteers = [];
let mockVolunteerRatings = [];

function findMockUserById(userId) {
  return mockUsers.find((user) => String(user.id) === String(userId) || String(user.userId) === String(userId));
}

function findMockRequestById(requestId) {
  return mockRequests.find((request) => String(request.id) === String(requestId));
}

function ensureMockVolunteerMeta(user) {
  if (!user) return null;

  const totalHelpCount = Math.max(user.totalHelpCount ?? 0, user.requestsHelped ?? 0);
  user.totalHelpCount = totalHelpCount;
  user.requestsHelped = totalHelpCount;
  user.isVolunteer = Boolean(user.isVolunteer);
  user.volunteerStatus = user.volunteerStatus || 'OFFLINE';
  user.volunteerCategories = Array.isArray(user.volunteerCategories)
    ? [...new Set(user.volunteerCategories.map((category) => String(category).trim().toUpperCase()).filter(Boolean))]
    : [];
  user.rating = Number(user.rating ?? 0);
  user.badges = getVolunteerBadges(totalHelpCount).map((badge) => badge.label);
  user.badge = getPrimaryVolunteerBadge(totalHelpCount)?.label || user.badge || 'Newcomer';
  return user;
}

function applyMockVolunteerProfile(email, profile) {
  const user = mockUsers.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
  if (!user) return;
  Object.assign(user, profile);
  ensureMockVolunteerMeta(user);
}

function initializeMockVolunteerProfiles() {
  applyMockVolunteerProfile('rahul@example.com', { isVolunteer: true, volunteerStatus: 'ONLINE', volunteerCategories: ['GENERAL', 'FOOD'] });
  applyMockVolunteerProfile('priya@example.com', { isVolunteer: true, volunteerStatus: 'ONLINE', volunteerCategories: ['BLOOD_DONATION', 'MEDICAL'] });
  applyMockVolunteerProfile('amit@example.com', { isVolunteer: true, volunteerStatus: 'ONLINE', volunteerCategories: ['FOOD', 'GENERAL'] });
  applyMockVolunteerProfile('sneha@example.com', { isVolunteer: true, volunteerStatus: 'ONLINE', volunteerCategories: ['FOOD', 'GENERAL'] });
  applyMockVolunteerProfile('vikram@example.com', { isVolunteer: true, volunteerStatus: 'ONLINE', volunteerCategories: ['GENERAL', 'MEDICAL'] });
  mockUsers.forEach(ensureMockVolunteerMeta);
}

function getMockPublicUser(user) {
  const normalizedUser = ensureMockVolunteerMeta(user);
  if (!normalizedUser) return null;

  return {
    ...toPublicUser(normalizedUser),
    volunteerCategories: [...(normalizedUser.volunteerCategories || [])],
    badges: [...(normalizedUser.badges || [])],
  };
}

function syncMockRequestShape(request) {
  if (!request) return null;

  if (request.status === 'ACCEPTED') {
    request.status = 'ACTIVE';
  }

  if (request.volunteer?.id) {
    const volunteer = findMockUserById(request.volunteer.id);
    if (volunteer) {
      request.volunteer = {
        ...request.volunteer,
        fullName: volunteer.fullName,
        rating: volunteer.rating,
        totalHelpCount: volunteer.totalHelpCount,
        badge: volunteer.badge,
      };
      request.volunteerId = volunteer.id;
      request.volunteerName = volunteer.fullName;
    }
  }

  if (request.requester?.id) {
    const requester = findMockUserById(request.requester.id);
    if (requester) {
      request.requester = {
        ...request.requester,
        fullName: requester.fullName,
        rating: requester.rating,
      };
      request.requesterId = requester.id;
      request.requesterName = requester.fullName;
    }
  }

  if (request.status === 'ACTIVE' && !request.volunteerProgressStatus) {
    request.volunteerProgressStatus = 'ASSIGNED';
  }

  if (request.status === 'COMPLETED' && !request.volunteerProgressStatus) {
    request.volunteerProgressStatus = 'COMPLETED';
  }

  request.requesterRatingPending = Boolean(request.requesterRatingPending);
  request.requesterRated = Boolean(request.requesterRated);
  return request;
}

function getMockRequestAssignment(requestId, volunteerId) {
  return mockRequestVolunteers.find(
    (assignment) => String(assignment.requestId) === String(requestId)
      && String(assignment.volunteerId) === String(volunteerId)
  );
}

function upsertMockRequestAssignment(nextAssignment) {
  const existingIndex = mockRequestVolunteers.findIndex(
    (assignment) => String(assignment.requestId) === String(nextAssignment.requestId)
      && String(assignment.volunteerId) === String(nextAssignment.volunteerId)
  );

  if (existingIndex >= 0) {
    mockRequestVolunteers[existingIndex] = {
      ...mockRequestVolunteers[existingIndex],
      ...nextAssignment,
    };
    return mockRequestVolunteers[existingIndex];
  }

  const createdAssignment = {
    id: `rv-${nextAssignment.requestId}-${nextAssignment.volunteerId}`,
    assignedAt: new Date().toISOString(),
    ...nextAssignment,
  };
  mockRequestVolunteers.push(createdAssignment);
  return createdAssignment;
}

function getEligibleMockVolunteersForRequest(request) {
  if (!request?.latitude || !request?.longitude) return [];

  const eligibleVolunteers = mockUsers
    .map((user) => ensureMockVolunteerMeta(user))
    .filter((user) => user.isVolunteer && user.verified && user.volunteerStatus === 'ONLINE')
    .filter((user) => user.id !== request.requester?.id && user.id !== request.requesterId)
    .map((user) => ({
      user,
      distanceKm: calculateDistanceKm(request.latitude, request.longitude, user.latitude, user.longitude),
    }))
    .filter((entry) => entry.distanceKm != null)
    .filter((entry) => userCanHandleRequest(entry.user, request));

  const withinFive = eligibleVolunteers.filter((entry) => entry.distanceKm <= 5);
  if (withinFive.length > 0) {
    return withinFive.map((entry) => ({ ...entry, radiusKm: 5 }));
  }

  return eligibleVolunteers
    .filter((entry) => entry.distanceKm <= 10)
    .map((entry) => ({ ...entry, radiusKm: 10 }));
}

function userCanHandleRequest(user, request) {
  const volunteerCategory = mapRequestCategoryToVolunteerCategory(request.category);
  return (user.volunteerCategories || []).includes(volunteerCategory);
}

function notifyMockVolunteersForRequest(request) {
  syncMockRequestShape(request);
  if (request.status !== 'OPEN') return [];

  const matches = getEligibleMockVolunteersForRequest(request);
  request.currentTier = matches.some((match) => match.radiusKm === 10) ? 2 : 1;

  matches.forEach((match) => {
    const existingAssignment = getMockRequestAssignment(request.id, match.user.id);
    if (['DECLINED', 'ACCEPTED', 'COMPLETED'].includes(existingAssignment?.status)) {
      return;
    }

    upsertMockRequestAssignment({
      requestId: request.id,
      volunteerId: match.user.id,
      status: 'PENDING',
      distanceKm: match.distanceKm,
      radiusKm: match.radiusKm,
    });
  });

  return matches;
}

function initializeMockVolunteerAssignments() {
  mockRequests.forEach((request) => syncMockRequestShape(request));
  mockRequests
    .filter((request) => request.status === 'OPEN')
    .forEach((request) => notifyMockVolunteersForRequest(request));
}

function refreshMockIncomingAssignments() {
  mockRequests
    .filter((request) => request.status === 'OPEN')
    .forEach((request) => notifyMockVolunteersForRequest(request));
}

initializeMockVolunteerProfiles();
initializeMockVolunteerAssignments();

function toPublicUser(user) {
  const { password, ...publicUser } = user;
  return publicUser;
}

function formatNameFromEmail(email = '') {
  const localPart = email.split('@')[0] || 'hvhn-member';
  const fullName = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return fullName || 'Sahay Member';
}

function buildFirebaseSessionUser({ email, token, firebaseUid, fullName }) {
  const normalizedEmail = email.trim().toLowerCase();

  return {
    id: firebaseUid || normalizedEmail,
    userId: firebaseUid || normalizedEmail,
    token: token || `firebase-email-link-${normalizedEmail}`,
    fullName: fullName || formatNameFromEmail(normalizedEmail),
    email: normalizedEmail,
    role: 'USER',
    points: 0,
    requestsHelped: 0,
    requestsCreated: 0,
    rating: 5.0,
    verified: true,
    badge: 'Verified Member',
    address: '',
  };
}

function getStoredSessionUser() {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem('hvhn_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function cloneDirectoryMember(member) {
  return {
    ...member,
    skills: [...(member.skills || [])],
    languages: [...(member.languages || [])],
  };
}

function buildSessionCommunityMember(user, community) {
  if (!user) return null;

  return {
    id: user.userId || user.id || user.email,
    fullName: user.fullName || formatNameFromEmail(user.email || ''),
    email: user.email || '',
    verified: user.verified !== false,
    points: user.points || 0,
    requestsHelped: user.requestsHelped || 0,
    rating: user.rating || 5,
    address: user.address || community.address,
    roleLabel: user.role === 'ADMIN' ? 'Community Admin' : 'Member',
    title: 'Joined member',
    availability: 'Available now',
    responseTime: '~10 min',
    lastActive: new Date().toISOString(),
    skills: ['Community support', 'Coordination'],
    languages: ['English', 'Hindi'],
    bio: 'Recently joined and ready to collaborate on community requests.',
    supportStyle: 'Responsive teammate',
    trustScore: Math.max(80, Math.min(99, 80 + Math.floor((user.points || 0) / 20))),
  };
}

function isStoredUserJoined(communityId) {
  const storedUser = getStoredSessionUser();
  if (!storedUser) return false;

  const joinedByUserId = joinedCommunities[storedUser.userId] || [];
  const joinedById = joinedCommunities[storedUser.id] || [];
  return [...joinedByUserId, ...joinedById].includes(communityId);
}

function ensureSessionMemberInDirectory(communityId, user) {
  const community = mockCommunities.find((entry) => entry.id === communityId);
  if (!community || !user) return;

  if (!Array.isArray(communityMemberDirectory[communityId])) {
    communityMemberDirectory[communityId] = [];
  }

  const userId = String(user.userId || user.id || '');
  const email = String(user.email || '').toLowerCase();
  const fullName = String(user.fullName || '').trim().toLowerCase();

  const existingIndex = communityMemberDirectory[communityId].findIndex((member) => {
    const memberId = String(member.id || '');
    const memberEmail = String(member.email || '').toLowerCase();
    const memberName = String(member.fullName || '').trim().toLowerCase();
    return (
      (userId && memberId === userId) ||
      (email && memberEmail === email) ||
      (fullName && memberName === fullName)
    );
  });

  const sessionMember = buildSessionCommunityMember(user, community);
  if (!sessionMember) return;

  if (existingIndex >= 0) {
    communityMemberDirectory[communityId][existingIndex] = {
      ...communityMemberDirectory[communityId][existingIndex],
      ...sessionMember,
    };
    return;
  }

  communityMemberDirectory[communityId].unshift(sessionMember);
}

function removeSessionMemberFromDirectory(communityId, user) {
  if (!communityMemberDirectory[communityId] || !user) return;

  const userId = String(user.userId || user.id || '');
  const email = String(user.email || '').toLowerCase();
  const fullName = String(user.fullName || '').trim().toLowerCase();

  const directory = Array.isArray(communityMemberDirectory[communityId]) ? communityMemberDirectory[communityId] : [];
  communityMemberDirectory[communityId] = directory.filter((member) => {
    const memberId = String(member.id || '');
    const memberEmail = String(member.email || '').toLowerCase();
    const memberName = String(member.fullName || '').trim().toLowerCase();
    const isSessionMember =
      (userId && memberId === userId) ||
      (email && memberEmail === email) ||
      (fullName && memberName === fullName);

    return !isSessionMember || member.roleLabel !== 'Member';
  });
}

// AI categorization keywords
const AI_CATEGORIES = {
  BLOOD_DONATION: ['blood', 'donor', 'transfusion', 'plasma', 'platelet'],
  MEDICAL: ['medical', 'doctor', 'hospital', 'medicine', 'health', 'surgery', 'oxygen', 'wheelchair', 'nurse'],
  FOOD: ['food', 'meal', 'hungry', 'water', 'groceries', 'ration', 'tiffin'],
  TRANSPORT: ['transport', 'ride', 'vehicle', 'car', 'ambulance', 'cab', 'pickup'],
  EMERGENCY: ['emergency', 'fire', 'flood', 'earthquake', 'disaster', 'accident', 'rescue', 'sos'],
};

const AI_URGENCY = {
  CRITICAL: ['dying', 'critical', 'life-threatening', 'immediate', 'sos', 'emergency', 'fire', 'urgent'],
  HIGH: ['urgent', 'quickly', 'soon', 'important', 'serious', 'rush', 'fast'],
  MEDIUM: ['needed', 'required', 'help', 'assist', 'support', 'looking for'],
};

function aiCategorize(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  let cat = 'GENERAL', maxScore = 0;
  for (const [category, keywords] of Object.entries(AI_CATEGORIES)) {
    const score = keywords.filter(k => text.includes(k)).length;
    if (score > maxScore) { maxScore = score; cat = category; }
  }
  let urg = 'LOW';
  for (const k of AI_URGENCY.CRITICAL) { if (text.includes(k)) { urg = 'CRITICAL'; break; } }
  if (urg === 'LOW') for (const k of AI_URGENCY.HIGH) { if (text.includes(k)) { urg = 'HIGH'; break; } }
  if (urg === 'LOW') for (const k of AI_URGENCY.MEDIUM) { if (text.includes(k)) { urg = 'MEDIUM'; break; } }
  return { category: cat, urgency: urg, summary: `AI Analysis: ${urg} urgency ${cat.toLowerCase().replace('_', ' ')} request.` };
}

// OTP storage: { email: { otp, expires } }
const otpStore = {};

// ====== MOCK API ======
const mockApi = {
  announcements: {
    data: [
      { id: 'ann-1', communityId: 1, title: 'Campus Blood Drive', body: 'Join us tomorrow at 10 AM in the main auditorium.', authorName: 'Rahul Sharma', isPinned: true, createdAt: new Date().toISOString() }
    ],
    getByCommunity: async (communityId) => ({ data: mockApi.announcements.data.filter(a => String(a.communityId) === String(communityId)) }),
    create: async (communityId, data) => {
      const newAnn = { ...data, id: 'ann-' + Date.now(), communityId, createdAt: new Date().toISOString(), isPinned: false };
      mockApi.announcements.data.push(newAnn);
      return { data: newAnn };
    },
    delete: async (communityId, id) => {
      mockApi.announcements.data = mockApi.announcements.data.filter(a => a.id !== id);
      return { data: null };
    },
    togglePin: async (communityId, id) => {
      const ann = mockApi.announcements.data.find(a => a.id === id);
      if (ann) ann.isPinned = !ann.isPinned;
      return { data: ann };
    },
    getPinned: async () => ({ data: mockApi.announcements.data.filter(a => a.isPinned) }),
  },
  auth: {
    login: async (data) => {
      const normalizedEmail = data.email.trim().toLowerCase();
      const user = mockUsers.find(u => u.email.toLowerCase() === normalizedEmail);
      if (!user) throw new Error('User not found. Register first or try rahul@example.com / pass123');
      if (user.password !== data.password) throw new Error('Invalid email or password.');
      return { data: { token: 'mock-jwt-token-' + user.id, ...getMockPublicUser(user), userId: user.id } };
    },
    loginWithFirebase: async ({ email, token, firebaseUid, fullName }) => {
      const normalizedEmail = email.trim().toLowerCase();
      let user = mockUsers.find((entry) => entry.email.toLowerCase() === normalizedEmail);

      if (!user) {
        user = {
          id: nextId++,
          fullName: fullName || formatNameFromEmail(normalizedEmail),
          email: normalizedEmail,
          password: '__firebase__',
          role: 'USER',
          points: 0,
          requestsHelped: 0,
          requestsCreated: 0,
          rating: 0,
          verified: true,
          badge: 'Verified Member',
          address: '',
          firebaseUid,
        };
        mockUsers.push(user);
      } else if (firebaseUid) {
        user.firebaseUid = firebaseUid;
        if (fullName && user.fullName !== fullName) {
          user.fullName = fullName;
        }
      }

      ensureMockVolunteerMeta(user);
      return { data: { token: token || 'mock-jwt-token-' + user.id, ...getMockPublicUser(user), userId: user.id } };
    },
    sendOtp: async (email) => {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      otpStore[email] = { otp, expires: Date.now() + 300000 };
      return { data: { message: `OTP sent to ${email}`, verified: false, retryAfterSeconds: 30, expiresInSeconds: 300 } };
    },
    verifyOtp: async (email, otp) => {
      const entry = otpStore[email];
      if (!entry) throw new Error('No OTP found. Please request a new one.');
      if (Date.now() > entry.expires) throw new Error('OTP expired. Please request a new one.');
      if (entry.otp !== otp) throw new Error('Invalid OTP. Please try again.');
      delete otpStore[email];
      return { data: { verified: true } };
    },
    register: async (data) => {
      if (mockUsers.find(u => u.email === data.email)) throw new Error('Email already registered.');
      const newUser = {
        id: nextId++,
        ...data,
        role: 'USER',
        points: 0,
        requestsHelped: 0,
        requestsCreated: 0,
        rating: 0,
        verified: true,
        badge: 'Newcomer',
      };
      mockUsers.push(newUser);
      ensureMockVolunteerMeta(newUser);
      return { data: { token: 'mock-jwt-token-' + newUser.id, ...getMockPublicUser(newUser), userId: newUser.id } };
    }
  },
  requests: {
    getOpen: async () => ({
      data: mockRequests
        .filter((request) => syncMockRequestShape(request).status === 'OPEN')
        .sort((a, b) => {
          const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          return (order[a.urgency] || 4) - (order[b.urgency] || 4);
        })
    }),
    getAll: async () => ({ data: [...mockRequests].map(syncMockRequestShape).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) }),
    getById: async (id) => {
      const request = findMockRequestById(id);
      if (!request) throw new Error('Not found');
      request.viewCount++;
      return { data: syncMockRequestShape(request) };
    },
    getMy: async (userId) => ({ data: mockRequests.filter((request) => String(request.requester?.id) === String(userId)).map(syncMockRequestShape) }),
    getVolunteered: async (userId) => ({ data: mockRequests.filter((request) => String(request.volunteer?.id) === String(userId)).map(syncMockRequestShape) }),
    create: async (data, user) => {
      const community = mockCommunities.find(c => c.id === parseInt(data.communityId));
      const ai = aiCategorize(data.title, data.description);
      const newReq = {
        id: nextId++, ...data,
        category: data.category || ai.category,
        urgency: data.urgency || ai.urgency,
        status: 'OPEN',
        aiCategory: ai.category, aiUrgency: ai.urgency, aiSummary: ai.summary,
        viewCount: 0, responseCount: 0, currentTier: 1,
        createdAt: new Date().toISOString(),
        requester: { id: user.userId, fullName: user.fullName, rating: user.rating || 4.5, email: user.email },
        community: community ? { id: community.id, name: community.name } : undefined,
        requesterRatingPending: false,
        requesterRated: false,
      };
      mockRequests.unshift(syncMockRequestShape(newReq));
      notifyMockVolunteersForRequest(newReq);
      return { data: newReq };
    },
    accept: async (id, user) => mockApi.volunteer.accept(id, user),
    complete: async (id, user) => mockApi.volunteer.updateRequestStatus(id, 'COMPLETED', user),
    cancel: async (id) => {
      const request = findMockRequestById(id);
      if (request) {
        request.status = 'CANCELLED';
        request.volunteerProgressStatus = null;
        request.requesterRatingPending = false;
      }
      return { data: syncMockRequestShape(request) };
    }
  },
  users: {
    getImpact: async () => {
      const user = getStoredSessionUser();
      return {
        data: {
          currentStreak: user?.currentStreak || 0,
          longestStreak: user?.longestStreak || 0,
          totalDistanceTraveled: user?.totalDistanceTraveled || 0,
          totalPeopleHelped: user?.totalPeopleHelped || 0,
          points: user?.points || 0
        }
      };
    },
    getProfile: async (userId) => ({ data: getMockPublicUser(findMockUserById(userId) || mockUsers[0]) }),
    getLeaderboard: async () => ({ data: [...mockUsers].map(getMockPublicUser).sort((a, b) => b.points - a.points) }),
    updateSchedule: async (userId, data) => {
      const user = findMockUserById(userId);
      if (user) {
        user.isAlwaysAvailable = data.isAlwaysAvailable;
        user.availabilitySchedule = data.schedule;
      }
      return { data: getMockPublicUser(user) };
    },
  },
  communities: {
    getAll: async () => ({ data: mockCommunities }),
    getDetail: async (communityId) => {
      const community = mockCommunities.find(c => c.id === communityId);
      if (!community) throw new Error('Community not found.');
      if (isStoredUserJoined(communityId)) {
        ensureSessionMemberInDirectory(communityId, getStoredSessionUser());
      }
      const members = (communityMemberDirectory[communityId] || []).map(cloneDirectoryMember);
      // Find requests from this community
      const requests = mockRequests.filter(r => r.community?.id === communityId);
      return { data: { community, members, requests } };
    },
    getJoined: async (userId) => {
      const ids = joinedCommunities[userId] || [];
      return { data: ids };
    },
    join: async (communityId, verificationCode, userId) => {
      const community = mockCommunities.find(c => c.id === parseInt(communityId));
      if (!community) throw new Error('Community not found.');
      if (community.verificationCode && community.verificationCode !== verificationCode) {
        throw new Error('Invalid verification code. Please check with your community admin.');
      }
      if (!joinedCommunities[userId]) joinedCommunities[userId] = [];
      if (joinedCommunities[userId].includes(community.id)) {
        throw new Error('You are already a member of this community.');
      }
      joinedCommunities[userId].push(community.id);
      community.memberCount++;
      ensureSessionMemberInDirectory(community.id, getStoredSessionUser());
      return { data: { message: `Successfully joined ${community.name}!`, community } };
    },
    leave: async (communityId, userId) => {
      const community = mockCommunities.find(c => c.id === parseInt(communityId));
      if (!community) throw new Error('Community not found.');
      if (!joinedCommunities[userId]) joinedCommunities[userId] = [];
      joinedCommunities[userId] = joinedCommunities[userId].filter(id => id !== community.id);
      community.memberCount = Math.max(0, community.memberCount - 1);
      removeSessionMemberFromDirectory(community.id, getStoredSessionUser());
      return { data: { message: `Left ${community.name}.` } };
    },
    create: async (data, userId) => {
      const newCommunity = {
        id: nextId++,
        name: data.name,
        type: data.type,
        description: data.description,
        address: data.address,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        radiusKm: data.radiusKm || 5.0,
        verificationCode: data.verificationCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
        memberCount: 1,
        active: true,
        focusAreas: ['Rapid support', 'Member coordination'],
      };
      mockCommunities.push(newCommunity);
      // Auto-join the creator
      if (userId) {
        if (!joinedCommunities[userId]) joinedCommunities[userId] = [];
        joinedCommunities[userId].push(newCommunity.id);
      }
      communityMemberDirectory[newCommunity.id] = [];
      ensureSessionMemberInDirectory(newCommunity.id, getStoredSessionUser());
      return { data: newCommunity };
    }
  },
  volunteer: {
    toggle: async (userId, isVolunteer) => {
      const user = findMockUserById(userId);
      if (!user) throw new Error('Volunteer account not found.');
      ensureMockVolunteerMeta(user);
      user.isVolunteer = Boolean(isVolunteer);
      user.volunteerStatus = user.isVolunteer ? user.volunteerStatus || 'OFFLINE' : 'OFFLINE';
      if (!user.isVolunteer) {
        user.volunteerCategories = [];
      }
      ensureMockVolunteerMeta(user);
      refreshMockIncomingAssignments();
      return { data: getMockPublicUser(user) };
    },
    updateStatus: async (userId, status) => {
      const user = findMockUserById(userId);
      if (!user?.isVolunteer) throw new Error('Enable volunteer mode first.');
      user.volunteerStatus = String(status || '').trim().toUpperCase() || 'OFFLINE';
      ensureMockVolunteerMeta(user);
      refreshMockIncomingAssignments();
      return { data: getMockPublicUser(user) };
    },
    updateCategories: async (userId, categories) => {
      const user = findMockUserById(userId);
      if (!user?.isVolunteer) throw new Error('Enable volunteer mode first.');
      user.volunteerCategories = [...new Set((categories || []).map((category) => String(category).trim().toUpperCase()).filter(Boolean))];
      ensureMockVolunteerMeta(user);
      refreshMockIncomingAssignments();
      return { data: getMockPublicUser(user) };
    },
    updateLocation: async (userId, location) => {
      const user = findMockUserById(userId);
      if (!user) throw new Error('Volunteer account not found.');
      user.latitude = location?.latitude;
      user.longitude = location?.longitude;
      refreshMockIncomingAssignments();
      return { data: getMockPublicUser(user) };
    },
    getNearby: async (requestId) => {
      const request = findMockRequestById(requestId);
      if (!request) throw new Error('Request not found.');
      const matches = getEligibleMockVolunteersForRequest(request).map((match) => ({
        ...getMockPublicUser(match.user),
        distanceKm: match.distanceKm,
        radiusKm: match.radiusKm,
      }));
      return { data: matches };
    },
    getBloodMatches: async (bloodGroup) => {
      const matches = mockUsers
        .filter((u) => u.isVolunteer && u.isBloodDonor && u.volunteerStatus === 'ONLINE')
        .map((u) => ({
          ...getMockPublicUser(u),
          bloodGroup: u.bloodGroup,
          distanceKm: (Math.random() * 5 + 1).toFixed(1),
        }));
      return { data: matches };
    },
    getIncoming: async (userId) => {
      const incomingRequests = mockRequestVolunteers
        .filter((assignment) => String(assignment.volunteerId) === String(userId) && assignment.status === 'PENDING')
        .map((assignment) => {
          const request = findMockRequestById(assignment.requestId);
          if (!request || request.status !== 'OPEN') return null;
          request.distanceKm = assignment.distanceKm;
          return syncMockRequestShape(request);
        })
        .filter(Boolean);
      return { data: incomingRequests };
    },
    getActive: async (userId) => ({
      data: mockRequests
        .filter((request) => String(request.volunteer?.id) === String(userId) && request.status === 'ACTIVE')
        .map(syncMockRequestShape),
    }),
    getCompleted: async (userId) => ({
      data: mockRequests
        .filter((request) => String(request.volunteer?.id) === String(userId) && request.status === 'COMPLETED')
        .map(syncMockRequestShape),
    }),
    accept: async (requestId, user) => {
      const request = findMockRequestById(requestId);
      const volunteer = findMockUserById(user?.userId || user?.id);
      if (!request) throw new Error('Request not found.');
      if (!volunteer?.isVolunteer) throw new Error('Enable volunteer mode first.');
      if (request.status !== 'OPEN') throw new Error('This request is no longer available.');

      const assignment = getMockRequestAssignment(requestId, volunteer.id);
      const matches = assignment ? [{ user: volunteer, distanceKm: assignment.distanceKm, radiusKm: assignment.radiusKm }] : getEligibleMockVolunteersForRequest(request);
      const volunteerMatch = matches.find((match) => String(match.user.id) === String(volunteer.id));
      if (!volunteerMatch) {
        throw new Error('This request is outside your current volunteer radius or categories.');
      }

      upsertMockRequestAssignment({
        requestId,
        volunteerId: volunteer.id,
        status: 'ACCEPTED',
        distanceKm: volunteerMatch.distanceKm,
        radiusKm: volunteerMatch.radiusKm,
        respondedAt: new Date().toISOString(),
      });

      request.status = 'ACTIVE';
      request.acceptedAt = new Date().toISOString();
      request.responseCount = (request.responseCount || 0) + 1;
      request.volunteerProgressStatus = 'ASSIGNED';
      request.volunteerStatusUpdatedAt = new Date().toISOString();
      request.requesterRatingPending = false;
      request.requesterRated = false;
      request.volunteer = {
        id: volunteer.id,
        fullName: volunteer.fullName,
        rating: volunteer.rating,
        totalHelpCount: volunteer.totalHelpCount,
        badge: volunteer.badge,
      };
      volunteer.points = (volunteer.points || 0) + 10;
      ensureMockVolunteerMeta(volunteer);
      return { data: syncMockRequestShape(request) };
    },
    decline: async (requestId, user) => {
      const volunteer = findMockUserById(user?.userId || user?.id);
      const request = findMockRequestById(requestId);
      if (!request) throw new Error('Request not found.');
      if (!volunteer?.isVolunteer) throw new Error('Enable volunteer mode first.');

      const distanceKm = calculateDistanceKm(request.latitude, request.longitude, volunteer.latitude, volunteer.longitude);
      upsertMockRequestAssignment({
        requestId,
        volunteerId: volunteer.id,
        status: 'DECLINED',
        distanceKm,
        radiusKm: distanceKm <= 5 ? 5 : 10,
        respondedAt: new Date().toISOString(),
      });
      return { data: { requestId, status: 'DECLINED' } };
    },
    updateRequestStatus: async (requestId, status, user) => {
      const volunteer = findMockUserById(user?.userId || user?.id);
      const request = findMockRequestById(requestId);
      if (!request) throw new Error('Request not found.');
      if (!volunteer?.isVolunteer) throw new Error('Enable volunteer mode first.');
      if (String(request.volunteer?.id) !== String(volunteer.id)) throw new Error('Only the assigned volunteer can update this request.');

      const normalizedStatus = String(status || '').trim().toUpperCase();
      request.volunteerProgressStatus = normalizedStatus;
      request.volunteerStatusUpdatedAt = new Date().toISOString();

      if (normalizedStatus === 'COMPLETED') {
        request.status = 'COMPLETED';
        request.completedAt = new Date().toISOString();
        request.requesterRatingPending = true;
        request.requesterRated = false;
        volunteer.points = (volunteer.points || 0) + 50;
      } else if (normalizedStatus === 'PENDING_COMPLETION') {
        // Keep status as ACTIVE, just set progress to PENDING_COMPLETION
        request.status = 'ACTIVE';
      } else {
        request.status = 'ACTIVE';
      }

      ensureMockVolunteerMeta(volunteer);
      upsertMockRequestAssignment({
        requestId,
        volunteerId: volunteer.id,
        status: normalizedStatus === 'COMPLETED' ? 'COMPLETED' : 'ACCEPTED',
        respondedAt: new Date().toISOString(),
        completedAt: normalizedStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
      });
      return { data: syncMockRequestShape(request) };
    },
    verifyCompletion: async (requestId, user) => {
      const request = findMockRequestById(requestId);
      if (!request) throw new Error('Request not found.');
      if (String(request.requester?.id) !== String(user?.userId || user?.id)) throw new Error('Only the requester can verify completion.');
      if (request.volunteerProgressStatus !== 'PENDING_COMPLETION') throw new Error('Request is not pending completion verification.');

      request.status = 'COMPLETED';
      request.volunteerProgressStatus = 'COMPLETED';
      request.completedAt = new Date().toISOString();
      request.requesterRatingPending = true;
      request.requesterRated = false;

      const volunteer = findMockUserById(request.volunteer?.id);
      if (volunteer) {
        volunteer.points = (volunteer.points || 0) + 50;
        ensureMockVolunteerMeta(volunteer);
      }

      upsertMockRequestAssignment({
        requestId,
        volunteerId: request.volunteer?.id,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      });
      return { data: syncMockRequestShape(request) };
    },
    rejectCompletion: async (requestId, user) => {
      const request = findMockRequestById(requestId);
      if (!request) throw new Error('Request not found.');
      if (String(request.requester?.id) !== String(user?.userId || user?.id)) throw new Error('Only the requester can reject completion.');
      if (request.volunteerProgressStatus !== 'PENDING_COMPLETION') throw new Error('Request is not pending completion verification.');

      request.volunteerProgressStatus = 'REACHED';
      request.status = 'ACTIVE';
      return { data: syncMockRequestShape(request) };
    },
    rate: async ({ requestId, volunteerId, rating, feedback }, userId) => {
      const request = findMockRequestById(requestId);
      const requester = findMockUserById(userId);
      const volunteer = findMockUserById(volunteerId);
      if (!request) throw new Error('Request not found.');
      if (request.status !== 'COMPLETED') throw new Error('Only completed requests can be rated.');
      if (String(request.requester?.id) !== String(requester?.id)) throw new Error('Only the requester can rate this volunteer.');
      if (request.requesterRated) throw new Error('This volunteer has already been rated for the request.');

      mockVolunteerRatings.push({
        id: `rating-${requestId}-${volunteerId}`,
        requestId,
        volunteerId,
        requesterId: requester.id,
        rating,
        feedback,
        createdAt: new Date().toISOString(),
      });

      const currentCount = volunteer.ratingCount || 0;
      const currentAverage = Number(volunteer.rating || 0);
      volunteer.rating = Number((((currentAverage * currentCount) + rating) / (currentCount + 1)).toFixed(2));
      volunteer.ratingCount = currentCount + 1;
      volunteer.totalHelpCount = Math.max(volunteer.totalHelpCount || 0, volunteer.requestsHelped || 0) + 1;
      volunteer.requestsHelped = volunteer.totalHelpCount;
      ensureMockVolunteerMeta(volunteer);

      request.requesterRated = true;
      request.requesterRatingPending = false;
      request.volunteerRating = rating;
      request.volunteerFeedback = feedback || '';
      syncMockRequestShape(request);

      return { data: { request, volunteer: getMockPublicUser(volunteer) } };
    },
    getStats: async (userId) => {
      const user = ensureMockVolunteerMeta(findMockUserById(userId));
      if (!user?.isVolunteer) throw new Error('Enable volunteer mode first.');

      const volunteers = mockUsers
        .map(ensureMockVolunteerMeta)
        .filter((entry) => entry.isVolunteer)
        .sort((a, b) => {
          if (b.totalHelpCount !== a.totalHelpCount) return b.totalHelpCount - a.totalHelpCount;
          return Number(b.rating || 0) - Number(a.rating || 0);
        });

      return {
        data: {
          totalHelped: user.totalHelpCount || 0,
          rating: user.rating || 0,
          rank: volunteers.findIndex((entry) => String(entry.id) === String(user.id)) + 1,
          badges: (user.badges || []).slice(),
        }
      };
    },
  },
  requests: {
    getAll: async () => ({ data: mockRequests.map(syncMockRequestShape) }),
    getById: async (id) => {
      const request = findMockRequestById(id);
      if (!request) throw new Error('Request not found.');
      request.viewCount = (request.viewCount || 0) + 1;
      return { data: syncMockRequestShape(request) };
    },
    getPublic: async (id) => {
      const request = findMockRequestById(id);
      if (!request) throw new Error('Request not found.');
      request.shareCount = (request.shareCount || 0) + 1;
      return { data: syncMockRequestShape(request) };
    },
    getOpen: async () => ({ data: mockRequests.filter(r => r.status === 'OPEN').map(syncMockRequestShape) }),
  },
  admin: {
    getDashboard: async () => ({
      data: {
        totalRequests: mockRequests.length,
        openRequests: mockRequests.filter(r => r.status === 'OPEN').length,
        completedRequests: mockRequests.filter(r => r.status === 'COMPLETED').length,
        totalUsers: mockUsers.length,
        totalVolunteers: mockUsers.filter(u => u.isVolunteer).length,
        totalCommunities: mockCommunities.length,
        requestsByCategory: { BLOOD_DONATION: 1, MEDICAL: 2, FOOD: 1, TRANSPORT: 1, EMERGENCY: 1, GENERAL: 0 },
        requestsByStatus: {
          OPEN: mockRequests.filter((request) => request.status === 'OPEN').length,
          ACCEPTED: mockRequests.filter((request) => request.status === 'ACCEPTED').length,
          COMPLETED: mockRequests.filter((request) => request.status === 'COMPLETED').length,
          CANCELLED: mockRequests.filter((request) => request.status === 'CANCELLED').length,
        }
      }
    }),
    getRequests: async () => ({ data: [...mockRequests].sort((a,b) => b.id - a.id) }),
    getUsers: async () => ({ data: [...mockUsers].map(getMockPublicUser) }),
    getPendingTrusted: async () => ({
      data: mockUsers.filter(u => u.verificationLevel === 'VERIFIED').map(getMockPublicUser)
    }),
    promoteToTrusted: async (userId) => {
      const u = findMockUserById(userId);
      if (u) {
        u.verificationLevel = 'TRUSTED';
      }
      return { data: getMockPublicUser(u) };
    },
    getFlaggedRequests: async () => ({
      data: mockRequests.filter(r => r.verificationStatus === 'FLAGGED').map(syncMockRequestShape)
    }),
    reviewRequest: async (requestId, status) => {
      const r = findMockRequestById(requestId);
      if (r) {
        r.verificationStatus = status;
        if (status === 'REJECTED') r.status = 'CANCELLED';
        r.adminReviewRequired = false;
      }
      return { data: syncMockRequestShape(r) };
    }
  },
  emailOtp: {
    send: async (communityId, email) => {
      await new Promise(r => setTimeout(r, 800));
      const domain = email.split('@')[1];
      const validDomains = { 1: ['iitd.ac.in','iit.ac.in'], 2: ['aiims.edu','aiims.in'], 3: ['gvs.com','greenvalley.com'] };
      const allowed = validDomains[communityId] || [];
      if (allowed.length > 0 && !allowed.some(d => domain?.endsWith(d))) {
        throw new Error(`Email domain @${domain} is not allowed for this community. Allowed: ${allowed.map(d => '@' + d).join(', ')}`);
      }
      sessionStorage.setItem(`otp_${communityId}_${email}`, '123456');
      return { data: { message: 'OTP sent successfully.', email } };
    },
    verify: async (communityId, email, otp, userId) => {
      await new Promise(r => setTimeout(r, 600));
      const stored = sessionStorage.getItem(`otp_${communityId}_${email}`);
      if (!stored || stored !== otp) throw new Error('Invalid OTP. Please try again.');
      sessionStorage.removeItem(`otp_${communityId}_${email}`);
      if (!joinedCommunities[userId]) joinedCommunities[userId] = [];
      if (!joinedCommunities[userId].includes(communityId)) {
        joinedCommunities[userId].push(communityId);
        const comm = mockCommunities.find(c => c.id === communityId);
        if (comm) comm.memberCount++;
      }
      return { data: { message: `Email verified! You have joined the community.` } };
    },
  },
  communityManage: {
    update: async (communityId, data) => {
      await new Promise(r => setTimeout(r, 500));
      const comm = mockCommunities.find(c => c.id === communityId);
      if (!comm) throw new Error('Community not found.');
      Object.assign(comm, data);
      return { data: comm };
    },
    delete: async (communityId) => {
      await new Promise(r => setTimeout(r, 500));
      const idx = mockCommunities.findIndex(c => c.id === communityId);
      if (idx === -1) throw new Error('Community not found.');
      mockCommunities.splice(idx, 1);
      Object.keys(joinedCommunities).forEach(uid => {
        joinedCommunities[uid] = joinedCommunities[uid].filter(id => id !== communityId);
      });
      return { data: { message: 'Community deleted.' } };
    },
    removeMember: async (communityId, memberId) => {
      await new Promise(r => setTimeout(r, 400));
      if (joinedCommunities[memberId]) {
        joinedCommunities[memberId] = joinedCommunities[memberId].filter(id => id !== communityId);
      }
      const comm = mockCommunities.find(c => c.id === communityId);
      if (comm) comm.memberCount = Math.max(0, comm.memberCount - 1);
      return { data: { message: 'Member removed.' } };
    },
    getMembers: async (communityId) => {
      await new Promise(r => setTimeout(r, 300));
      const mc = communityMemberDirectory[communityId] || [];
      return { data: Array.isArray(mc) ? mc : [] };
    },
  },
};

// Export the service layer
const apiService = {
  login: (data) => USE_MOCK_AUTH ? mockApi.auth.login(data) : api.post('/auth/login', data),
  loginWithFirebase: (payload) => USE_MOCK_AUTH
    ? mockApi.auth.loginWithFirebase(payload)
    : api.post('/auth/firebase', payload),
  loginWithEmailLink: (payload) => USE_MOCK_AUTH
    ? mockApi.auth.loginWithFirebase(payload)
    : api.post('/auth/firebase', payload),
  register: (data) => USE_MOCK_AUTH ? mockApi.auth.register(data) : api.post('/auth/register/verify', data),
  requestRegistrationOtp: (email) => USE_MOCK_AUTH ? mockApi.auth.sendOtp(email) : api.post('/auth/register/request-otp', { email }),
  verifyRegistration: (payload) => USE_MOCK_AUTH ? mockApi.auth.register(payload) : api.post('/auth/register/verify', payload),
  sendOtp: (email) => USE_MOCK_AUTH ? mockApi.auth.sendOtp(email) : api.post('/auth/register/request-otp', { email }),
  verifyOtp: (email, otp) => USE_MOCK_AUTH ? mockApi.auth.verifyOtp(email, otp) : api.post('/auth/verify-otp', { email, otp }),

  // Help Feed: use the default backend endpoint (/api/requests) which returns open requests.
  getOpenRequests: () => USE_MOCK
    ? mockApi.requests.getOpen()
    : api.get('/requests').then(res => {
        const raw = res.data;
        return { ...res, data: Array.isArray(raw) ? raw : Array.isArray(raw?.content) ? raw.content : [] };
      }),
  getNearbyRequests: (params) => USE_MOCK
    ? mockApi.requests.getOpen()
    : api.get('/requests/nearby', { params }).then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  getAllRequests: () => USE_MOCK ? mockApi.requests.getAll() : api.get('/requests').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : (res.data?.content || []) })),
  getRequestById: (id) => USE_MOCK ? mockApi.requests.getById(id) : getWithTransientRetry(`/requests/${id}`),
  getMyRequests: (userId) => USE_MOCK ? mockApi.requests.getMy(userId) : getWithTransientRetry('/requests/my').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : (res.data?.content || []) })),
  getVolunteeredRequests: (userId) => USE_MOCK ? mockApi.requests.getVolunteered(userId) : getWithTransientRetry('/requests/volunteered').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : (res.data?.content || []) })),
  createRequest: (data, user) => USE_MOCK ? mockApi.requests.create(data, user) : api.post('/requests', data),
  analyzeRequestMl: (data) => USE_MOCK
    ? Promise.resolve({ data: { available: false } })
    : api.post('/ml/request/analyze', data),
  detectDuplicateRequest: (data) => USE_MOCK
    ? Promise.resolve({ data: { available: false, duplicateLikely: false } })
    : api.post('/ml/request/duplicate', data),
  
  // Verification endpoints
  verifyMedicalDocument: (data) => api.post('/verification/ocr', data),
  
  // AI Smart Search
  smartSearchRequests: (query, candidates) => USE_MOCK
    ? Promise.resolve({ data: { available: false, results: [] } })
    : api.post('/ml/search/requests', { query, candidates }),
  smartSearch: (query) => api.get('/requests/smart-search', { params: { query } }),
  acceptRequest: (id, user) => USE_MOCK ? mockApi.requests.accept(id, user) : api.post(`/requests/${id}/accept`),
  requestCompletion: (id, user) => USE_MOCK ? mockApi.requests.complete(id, user) : api.post(`/requests/${id}/completion/request`),
  completeRequest: (id, user) => USE_MOCK ? mockApi.requests.complete(id, user) : api.post(`/requests/${id}/completion/request`),
  cancelRequest: (id) => USE_MOCK ? mockApi.requests.cancel(id) : api.post(`/requests/${id}/cancel`),
  updateRequestAvailability: (id, status) => api.post(`/requests/${id}/status`, { status }),
  verifyRequestCompletion: (id, user) => USE_MOCK ? mockApi.volunteer.verifyCompletion(id, user) : api.post(`/requests/${id}/completion/confirm`),
  rejectRequestCompletion: (id, user) => USE_MOCK ? mockApi.volunteer.rejectCompletion(id, user) : api.post(`/requests/${id}/completion/reject`),
  withdrawRequest: (id) => USE_MOCK ? mockApi.requests.cancel(id) : api.post(`/requests/${id}/withdraw`),
  deleteRequest: (id) => USE_MOCK ? mockApi.requests.cancel(id) : api.delete(`/requests/${id}`),
  removeAcceptedRequest: (id) => USE_MOCK ? Promise.resolve({}) : api.delete(`/requests/${id}/accepted`),
  getRequestTimeline: (id) => USE_MOCK ? Promise.resolve({ data: [] }) : getWithTransientRetry(`/requests/${id}/timeline`),
  getRequestComments: (id) => USE_MOCK ? Promise.resolve({ data: [] }) : getWithTransientRetry(`/requests/${id}/comments`),
  addRequestComment: (id, text) => USE_MOCK
    ? Promise.resolve({ data: { id: `mock-comment-${Date.now()}`, text, authorName: 'You', createdAt: new Date().toISOString() } })
    : api.post(`/requests/${id}/comments`, { text }),
  deleteRequestComment: (requestId, commentId) => USE_MOCK ? Promise.resolve({ data: { deleted: true } }) : api.delete(`/requests/${requestId}/comments/${commentId}`),
  getPublicRequest: (id) => USE_MOCK ? mockApi.requests.getPublic(id) : api.get(`/requests/public/${id}`),

  getProfile: (userId) => USE_MOCK_USERS ? mockApi.users.getProfile(userId) : api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me/profile', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  removeAvatar: () => api.delete('/users/me/avatar'),
  reverseGeocode: (latitude, longitude) => api.get('/locations/reverse', { params: { lat: latitude, lon: longitude } }),
  searchLocations: (query, type, config = {}) => api.get('/locations/search', { params: { q: query, type }, ...config }).then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  completeOnboarding: (data) => api.put('/users/me/onboarding', data),
  updateSkills: (skills) => api.put('/users/skills', { skills }),
  updateEmergencyContacts: (contacts) => api.put('/users/emergency-contacts', { contacts }),
  getLeaderboard: () => USE_MOCK_USERS ? mockApi.users.getLeaderboard() : api.get('/users/leaderboard').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  getUserImpact: () => USE_MOCK_USERS ? mockApi.users.getImpact() : api.get('/users/impact').then(res => ({ ...res, data: res.data || {} })),
  updateVolunteerSchedule: (userId, data) => USE_MOCK_USERS ? mockApi.users.updateSchedule(userId, data) : api.put('/users/volunteer/schedule', data),

  toggleVolunteer: (userId, isVolunteer) => USE_MOCK
    ? mockApi.volunteer.toggle(userId, isVolunteer)
    : api.put('/volunteer/toggle', { isVolunteer }),
  updateVolunteerAvailability: (userId, status) => USE_MOCK
    ? mockApi.volunteer.updateStatus(userId, status)
    : api.put('/volunteer/status', { status }),
  updateVolunteerCategories: (userId, categories) => USE_MOCK
    ? mockApi.volunteer.updateCategories(userId, categories)
    : api.put('/volunteer/categories', { categories }),
  updateVolunteerLocation: (userId, payload) => USE_MOCK
    ? mockApi.volunteer.updateLocation(userId, payload)
    : api.put('/volunteer/location', payload),
  getNearbyVolunteers: (requestId) => USE_MOCK
    ? mockApi.volunteer.getNearby(requestId)
    : api.get('/volunteer/nearby', { params: { requestId } }),
  getBloodMatches: (bloodGroup) => USE_MOCK
    ? mockApi.volunteer.getBloodMatches(bloodGroup)
    : api.get('/volunteer/blood-match', { params: { bloodGroup } }),
  getVolunteerIncomingRequests: (userId) => USE_MOCK
    ? mockApi.volunteer.getIncoming(userId)
    : api.get('/volunteer/incoming'),
  getVolunteerActiveRequests: (userId) => USE_MOCK
    ? mockApi.volunteer.getActive(userId)
    : api.get('/volunteer/active'),
  getVolunteerCompletedRequests: (userId) => USE_MOCK
    ? mockApi.volunteer.getCompleted(userId)
    : api.get('/volunteer/completed'),
  acceptVolunteerRequest: (requestId, user) => USE_MOCK
    ? mockApi.volunteer.accept(requestId, user)
    : api.put(`/volunteer/accept/${requestId}`),
  declineVolunteerRequest: (requestId, user) => USE_MOCK
    ? mockApi.volunteer.decline(requestId, user)
    : api.put(`/volunteer/decline/${requestId}`),
  updateVolunteerRequestStatus: (requestId, status, user) => USE_MOCK
    ? mockApi.volunteer.updateRequestStatus(requestId, status, user)
    : (['REQUEST_COMPLETION', 'COMPLETION_REQUESTED', 'PENDING_COMPLETION', 'COMPLETED'].includes(String(status || '').toUpperCase())
        ? api.post(`/requests/${requestId}/completion/request`)
        : api.post(`/requests/${requestId}/progress`, { action: status })),
  rateVolunteer: (payload, userId) => USE_MOCK
    ? mockApi.volunteer.rate(payload, userId)
    : api.post('/volunteer/rate', payload),
  getVolunteerStats: (userId) => USE_MOCK
    ? mockApi.volunteer.getStats(userId)
    : api.get('/volunteer/stats'),

  listCommunities: (params = {}) => api.get('/communities', { params }).then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : (res.data?.content || []) })),
  getCommunities: (params = {}) => apiService.listCommunities(params),
  getCommunityDetail: (id) => api.get(`/communities/${id}`),
  getCommunityDashboard: (id) => api.get(`/communities/${id}/dashboard`),
  getJoinedCommunities: async (userId) => {
    if (USE_MOCK) return mockApi.communities.getJoined(userId);
    try {
      const res = await api.get('/communities');
      const data = Array.isArray(res.data) ? res.data : [];
      const joinedIds = data
        .filter(c => c.membershipStatus === 'ACTIVE' || c.currentUserRole)
        .map(c => c.id);
      return { data: joinedIds };
    } catch (err) {
      return { data: [] };
    }
  },
  joinCommunity: (communityId, verificationCode) => api.post(`/communities/${communityId}/join`, { code: verificationCode }),
  leaveCommunity: (communityId) => api.post(`/communities/${communityId}/leave`),
  createCommunity: (data) => {
    const joinPolicy = data.joinPolicy || (data.verificationCode ? 'JOIN_CODE' : data.emailDomain ? 'EMAIL_DOMAIN' : 'OPEN');
    const payload = {
      name: data.name,
      description: data.description || 'Community details',
      category: data.category || data.type,
      visibility: data.visibility || 'PUBLIC',
      joinPolicy,
      address: data.address || data.location,
      city: data.city,
      district: data.district,
      state: data.state,
      latitude: data.latitude,
      longitude: data.longitude,
      rules: data.rules,
      tags: data.tags,
      coverImageUrl: data.coverImageUrl,
      logoUrl: data.logoUrl,
    };
    if (joinPolicy === 'JOIN_CODE') payload.joinCode = data.joinCode || data.verificationCode;
    if (joinPolicy === 'EMAIL_DOMAIN') payload.institutionDomain = data.institutionDomain || data.emailDomain;
    return api.post('/communities', payload);
  },

  // Email Domain Verification (Feature 2)
  sendEmailOTP: (communityId, email) => USE_MOCK ? mockApi.emailOtp.send(communityId, email) : api.post(`/communities/${communityId}/email-otp/send`, { email }),
  verifyEmailOTP: (communityId, email, otp, userId) => USE_MOCK ? mockApi.emailOtp.verify(communityId, email, otp, userId) : api.post(`/communities/${communityId}/email-otp/verify`, { email, otp }),

  // Community Management (Feature 4)
  updateCommunity: (communityId, data) => api.put(`/communities/${communityId}`, {
    ...data,
    category: data.category || data.type,
    address: data.address || data.location,
    description: data.description || 'Community details',
    joinPolicy: data.joinPolicy || (data.verificationCode ? 'JOIN_CODE' : data.emailDomain ? 'EMAIL_DOMAIN' : 'OPEN'),
    joinCode: data.joinCode || data.verificationCode,
    institutionDomain: data.institutionDomain || data.emailDomain,
  }),
  deleteCommunity: (communityId) => api.delete(`/communities/${communityId}`),
  removeCommunityMember: (communityId, memberId) => api.delete(`/communities/${communityId}/members/${memberId}`),
  updateCommunityMemberRole: (communityId, memberId, role) => api.put(`/communities/${communityId}/members/${memberId}/role`, { role }),
  createAnnouncement: (communityId, data) => api.post(`/communities/${communityId}/announcements`, data),
  broadcastMessage: (communityId, content) => api.post(`/communities/${communityId}/broadcast`, typeof content === 'object' ? content : { content }),
  broadcastCommunityMessage: (communityId, data) => apiService.broadcastMessage(communityId, data),
  getCommunityMembers: (communityId) => api.get(`/communities/${communityId}/members`).then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  getCommunityRequests: (communityId) => api.get(`/communities/${communityId}/requests`).then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  createCommunityRequest: (communityId, data) => {
    const { communityId: _ignoredCommunityId, scope: _ignoredScope, ...payload } = data || {};
    return api.post(`/communities/${communityId}/requests`, payload);
  },
  listQuestions: (communityId) => api.get(`/communities/${communityId}/questions`).then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  createQuestion: (communityId, data) => api.post(`/communities/${communityId}/questions`, data),
  createAnswer: (communityId, questionId, data) => api.post(`/communities/${communityId}/questions/${questionId}/answers`, data),
  upvoteQuestion: (communityId, questionId) => api.post(`/communities/${communityId}/questions/${questionId}/upvote`),
  upvoteAnswer: (communityId, questionId, answerId) => api.post(`/communities/${communityId}/questions/${questionId}/answers/${answerId}/upvote`),
  acceptAnswer: (communityId, questionId, answerId) => api.post(`/communities/${communityId}/questions/${questionId}/answers/${answerId}/accept`),
  listCampaigns: (communityId) => api.get(`/communities/${communityId}/campaigns`).then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  createCampaign: (communityId, data) => api.post(`/communities/${communityId}/campaigns`, data),
  contributeToCampaign: (communityId, campaignId, data) => api.post(`/communities/${communityId}/campaigns/${campaignId}/contributions`, data),
  messageCommunityMember: (communityId, memberId) => api.post(`/communities/${communityId}/members/${memberId}/message`),

  getDashboardStats: () => USE_MOCK ? mockApi.admin.getDashboard() : api.get('/admin/dashboard'),
  getAdminRequests: () => USE_MOCK ? mockApi.admin.getRequests() : api.get('/admin/requests').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  getAdminUsers: () => USE_MOCK ? mockApi.admin.getUsers() : api.get('/admin/users').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  getPendingTrusted: () => USE_MOCK ? mockApi.admin.getPendingTrusted() : api.get('/admin/pending-trusted').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  promoteToTrusted: (userId) => USE_MOCK ? mockApi.admin.promoteToTrusted(userId) : api.put(`/admin/users/${userId}/verify-trusted`),
  getFlaggedRequests: () => USE_MOCK ? mockApi.admin.getFlaggedRequests() : api.get('/admin/flagged').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  reviewRequest: (requestId, status) => USE_MOCK 
    ? mockApi.admin.reviewRequest(requestId, status) 
    : api.put(`/admin/requests/${requestId}/review`, { status }),

  getChatRooms: () => api.get('/chat/conversations').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  getChatConversations: () => apiService.getChatRooms(),
  getChatHistory: (roomId, page = 0, size = 50) => api.get(`/chat/conversations/${roomId}/messages`, { params: { page, size } }).then(res => ({
    ...res,
    data: Array.isArray(res.data)
      ? { messages: res.data, page, size, hasMore: false }
      : { ...res.data, messages: Array.isArray(res.data?.messages) ? res.data.messages : [] },
  })),
  getChatMessages: (roomId, page = 0, size = 50) => apiService.getChatHistory(roomId, page, size),
  createDirectChatRoom: (payload) => api.post('/chat/rooms/direct', payload),
  createGroupChatRoom: (payload) => api.post('/chat/rooms/group', payload),
  markChatMessageRead: (messageId) => api.put(`/chat/${messageId}/read`),
  markConversationSeen: (roomId, lastSeenMessageId) => api.post(`/chat/conversations/${roomId}/seen`, null, { params: { lastSeenMessageId } }),
  uploadChatAttachment: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteChatMessage: (messageId) => api.delete(`/chat/messages/${messageId}`),
  deleteChatRoom: (roomId) => api.delete(`/chat/conversations/${roomId}`),
  hideChatConversation: (roomId) => apiService.deleteChatRoom(roomId),
  toggleChatReaction: (messageId, emoji) => api.post(`/chat/messages/${messageId}/react`, null, { params: { emoji } }),
  getOnlineUsers: () => api.get('/presence/online-users'),

  getNotifications: (params = {}) => api.get('/notifications', { params }).then(res => ({
    ...res,
    data: {
      ...res.data,
      notifications: Array.isArray(res.data?.notifications) ? res.data.notifications : [],
    },
  })),
  getNotificationUnreadCount: () => api.get('/notifications/unread-count'),
  markNotificationRead: (notificationId) => api.post(`/notifications/${notificationId}/read`),
  markNotificationUnread: (notificationId) => api.post(`/notifications/${notificationId}/unread`),
  markAllNotificationsRead: (params = {}) => api.post('/notifications/read-all', null, { params }),
  deleteNotification: (notificationId) => api.delete(`/notifications/${notificationId}`),
  getNotificationPreferences: () => api.get('/notifications/preferences'),
  updateNotificationPreferences: (payload) => api.put('/notifications/preferences', payload),
  registerNotificationDevice: (payload) => api.post('/notifications/devices', payload),
  listNotificationDevices: () => api.get('/notifications/devices').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  deleteNotificationDevice: (deviceId) => api.delete(`/notifications/devices/${deviceId}`),
  sendAssistantMessage: (payload) => api.post('/assistant/chat', payload),

  // Announcements
  getAnnouncements: (communityId) => api.get(`/communities/${communityId}/announcements`).then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),
  deleteAnnouncement: (communityId, announcementId) => api.delete(`/communities/${communityId}/announcements/${announcementId}`),
  togglePinAnnouncement: (communityId, announcementId) => api.put(`/communities/${communityId}/announcements/${announcementId}/pin`),
  getPinnedAnnouncements: () => USE_MOCK ? mockApi.announcements.getPinned() : api.get('/community/announcements/pinned').then(res => ({ ...res, data: Array.isArray(res.data) ? res.data : [] })),

  // Sahay AI Engine
  processAiRequest: (payload) => api.post('/ai/process', payload),
  ai: {
    parseRequest: (rawText) => api.post('/ai/process', {
      mode: 'parse_request',
      data: {
        raw_text: rawText,
        user_id: 'current',
        community_id: 'global',
        timestamp: Date.now()
      }
    }),
    getResponseSuggestion: (request, volunteer) => api.post('/ai/process', {
      mode: 'response_suggestion',
      data: { request, volunteer }
    }),
    getFakeDetection: (text) => api.post('/ai/process', {
      mode: 'fake_detection',
      data: {
        request_text: text,
        user_id: 'current',
        user_history: { total_requests: 5, flagged_count: 0, account_age_days: 10 }
      }
    })
  }
};

export default apiService;
