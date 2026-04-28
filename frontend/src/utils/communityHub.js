const HELP_PLAYBOOK = {
  BLOOD_DONATION: {
    label: 'Blood response plan',
    steps: [
      'Confirm the exact blood group, hospital desk, and reporting time.',
      'Coordinate one donor now and keep one backup donor on standby.',
      'Carry ID proof, stay hydrated, and avoid arriving on an empty stomach.',
    ],
    supportOffers: ['Donate now', 'Coordinate donors', 'Share hospital logistics'],
    eta: '15-30 min',
  },
  MEDICAL: {
    label: 'Medical support plan',
    steps: [
      'Clarify whether medicines, equipment, or an escort is needed first.',
      'Check nearest pharmacies or volunteers with the required item.',
      'Keep a fallback transport option ready if the need escalates.',
    ],
    supportOffers: ['Arrange medicine', 'Escort patient', 'Source equipment'],
    eta: '20-45 min',
  },
  FOOD: {
    label: 'Relief support plan',
    steps: [
      'Estimate portions, dietary restrictions, and handoff location.',
      'Split the response into cooking, packing, and delivery roles.',
      'Confirm if the family needs repeat support later in the day.',
    ],
    supportOffers: ['Cook meals', 'Pack supplies', 'Deliver safely'],
    eta: '30-60 min',
  },
  TRANSPORT: {
    label: 'Transport support plan',
    steps: [
      'Confirm pickup point, destination, and whether a wheelchair is needed.',
      'Assign a driver plus one backup contact before departure.',
      'Share a live ETA with the requester and arrival contact.',
    ],
    supportOffers: ['Drive now', 'Arrange cab', 'Coordinate route'],
    eta: '10-25 min',
  },
  EMERGENCY: {
    label: 'Emergency response plan',
    steps: [
      'Escalate to emergency services first if there is an active hazard.',
      'Assign one responder to coordinate and one to support evacuations.',
      'Keep the area clear and collect critical updates in one thread.',
    ],
    supportOffers: ['Respond on-site', 'Coordinate helpers', 'Share emergency updates'],
    eta: 'Immediate',
  },
  GENERAL: {
    label: 'Support plan',
    steps: [
      'Confirm what the requester needs most in the next hour.',
      'Match one member for the immediate need and one for backup.',
      'Close the loop after delivery so the community knows the status.',
    ],
    supportOffers: ['Help directly', 'Coordinate people', 'Share updates'],
    eta: '30-45 min',
  },
};

const QUICK_REPLY_LIBRARY = [
  'I can help with the latest request. What is still needed most?',
  'Are you available to coordinate for the next hour?',
  'Can we split this into pickup, delivery, and follow-up?',
  'I am nearby. Share the exact location and best contact number.',
];

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getCommunityStorageKey(communityId, userId, suffix) {
  return `hvhn.community.${communityId}.${userId || 'guest'}.${suffix}`;
}

export function readCommunityState(communityId, userId, suffix, fallback) {
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(getCommunityStorageKey(communityId, userId, suffix));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeCommunityState(communityId, userId, suffix, value) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(
      getCommunityStorageKey(communityId, userId, suffix),
      JSON.stringify(value)
    );
  } catch {
    // Ignore storage failures and keep the in-memory page state usable.
  }
}

export function matchesCurrentUser(person, user) {
  if (!person || !user) return false;

  const personId = String(person.id ?? person.userId ?? '');
  const userId = String(user.userId ?? user.id ?? '');

  return (
    (personId && userId && personId === userId) ||
    (person.email && user.email && String(person.email).toLowerCase() === String(user.email).toLowerCase()) ||
    (person.fullName && user.fullName && person.fullName.trim().toLowerCase() === user.fullName.trim().toLowerCase())
  );
}

export function getRequestSupportPlan(request) {
  const plan = HELP_PLAYBOOK[request?.category] || HELP_PLAYBOOK.GENERAL;

  return {
    ...plan,
    statusNote:
      request?.status === 'OPEN'
        ? 'Still needs a primary responder.'
        : request?.status === 'ACCEPTED'
          ? 'A lead helper is assigned. Extra support can still reduce delays.'
          : request?.status === 'COMPLETED'
            ? 'Resolved. Share any follow-up support in chat if needed.'
            : 'Track with the requester before moving resources.',
  };
}

export function getMemberQuickReplies(member, request) {
  const replies = [...QUICK_REPLY_LIBRARY];

  if (request?.title) {
    replies.unshift(`Can you support "${request.title}" if it is still active?`);
  }

  if (member?.skills?.length) {
    replies.push(`You are great at ${member.skills[0].toLowerCase()}. Can you take lead there?`);
  }

  return replies.slice(0, 4);
}

export function buildConnectionRecord(member) {
  return {
    memberId: member.id,
    connectedAt: new Date().toISOString(),
    status: 'connected',
  };
}

export function buildStarterMessages(member, community) {
  return [
    {
      id: `seed-${member.id}-1`,
      sender: 'member',
      body: `Hi, I am available in ${community.name}. Feel free to ping me for coordination.`,
      sentAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: `seed-${member.id}-2`,
      sender: 'member',
      body: `I usually help with ${member.skills?.slice(0, 2).join(' and ') || 'community requests'}.`,
      sentAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
  ];
}

export function buildMemberReply(member, text, community) {
  const normalized = String(text || '').toLowerCase();

  if (normalized.includes('latest request') || normalized.includes('still needed')) {
    return `I can review the latest request in ${community.name} and tell you what is still open in a minute.`;
  }

  if (normalized.includes('available') || normalized.includes('free')) {
    return `I am ${member.availability?.toLowerCase() || 'available'} and can stay responsive here for the next hour.`;
  }

  if (normalized.includes('location') || normalized.includes('where')) {
    return `Send me the exact pickup point and I will plan the fastest route from ${member.address || 'my side'}.`;
  }

  if (normalized.includes('coordinate') || normalized.includes('split')) {
    return 'Yes, let us split it. I can take ownership of one stream and keep the rest updated here.';
  }

  return `Sounds good. I am happy to help inside ${community.name}; send me the next concrete step and I will pick it up.`;
}

export function getMemberBadge(member) {
  if (member?.roleLabel) return member.roleLabel;
  if ((member?.points || 0) >= 300) return 'Community Lead';
  if ((member?.requestsHelped || 0) >= 10) return 'Rapid Responder';
  if ((member?.requestsHelped || 0) >= 5) return 'Trusted Volunteer';
  return 'Active Member';
}

export function formatActivityTime(dateString) {
  if (!dateString) return 'Recently active';

  const diffMinutes = Math.max(1, Math.floor((Date.now() - new Date(dateString).getTime()) / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}
