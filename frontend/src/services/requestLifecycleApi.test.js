import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const client = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    client,
    axios: {
      create: vi.fn(() => client),
    },
  };
});

vi.mock('axios', () => ({
  default: mocks.axios,
}));

vi.mock('./apiConfig', () => ({
  API_BASE_URL: 'http://localhost:8080/api',
  USE_MOCK_API: false,
}));

vi.mock('../utils/sessionStorage', () => ({
  clearSessionStorage: vi.fn(),
  getStoredToken: vi.fn(() => null),
}));

describe('request lifecycle API endpoints', () => {
  let apiService;

  beforeEach(async () => {
    vi.clearAllMocks();
    apiService = (await import('./api')).default;
  });

  it('uses canonical request lifecycle endpoints', () => {
    apiService.requestCompletion('req-1');
    apiService.verifyRequestCompletion('req-1');
    apiService.rejectRequestCompletion('req-1');
    apiService.withdrawRequest('req-1');

    expect(mocks.client.post).toHaveBeenCalledWith('/requests/req-1/completion/request');
    expect(mocks.client.post).toHaveBeenCalledWith('/requests/req-1/completion/confirm');
    expect(mocks.client.post).toHaveBeenCalledWith('/requests/req-1/completion/reject');
    expect(mocks.client.post).toHaveBeenCalledWith('/requests/req-1/withdraw');
  });

  it('maps volunteer progress without sending PENDING_COMPLETION to progress endpoint', () => {
    apiService.updateVolunteerRequestStatus('req-2', 'ON_THE_WAY');
    apiService.updateVolunteerRequestStatus('req-2', 'PENDING_COMPLETION');
    apiService.updateVolunteerRequestStatus('req-2', 'COMPLETED');

    expect(mocks.client.post).toHaveBeenCalledWith('/requests/req-2/progress', { action: 'ON_THE_WAY' });
    expect(mocks.client.post).toHaveBeenCalledWith('/requests/req-2/completion/request');
    expect(mocks.client.post).not.toHaveBeenCalledWith('/requests/req-2/progress', { action: 'PENDING_COMPLETION' });
    expect(mocks.client.post).not.toHaveBeenCalledWith('/requests/req-2/progress', { action: 'COMPLETED' });
  });

  it('uses persisted comment endpoints', () => {
    apiService.getRequestComments('req-3');
    apiService.addRequestComment('req-3', 'I can help');
    apiService.deleteRequestComment('req-3', 'comment-1');

    expect(mocks.client.get).toHaveBeenCalledWith('/requests/req-3/comments');
    expect(mocks.client.post).toHaveBeenCalledWith('/requests/req-3/comments', { text: 'I can help' });
    expect(mocks.client.delete).toHaveBeenCalledWith('/requests/req-3/comments/comment-1');
  });

  it('uses canonical nearby request endpoint with query params', async () => {
    mocks.client.get.mockResolvedValueOnce({ data: [{ id: 'req-4', distanceKm: 1.2 }] });

    const result = await apiService.getNearbyRequests({
      latitude: 28.6139,
      longitude: 77.2090,
      radiusKm: 10,
      category: 'MEDICAL',
      city: 'Delhi',
    });

    expect(mocks.client.get).toHaveBeenCalledWith('/requests/nearby', {
      params: {
        latitude: 28.6139,
        longitude: 77.2090,
        radiusKm: 10,
        category: 'MEDICAL',
        city: 'Delhi',
      },
    });
    expect(result.data).toEqual([{ id: 'req-4', distanceKm: 1.2 }]);
  });

  it('uses canonical Phase 4 community endpoints and payloads', async () => {
    mocks.client.get.mockResolvedValue({ data: [] });

    await apiService.listCommunities({ city: 'Delhi' });
    apiService.createCommunity({
      name: 'Campus Helpers',
      type: 'COLLEGE',
      description: 'Verified campus help',
      address: 'Main gate',
      joinPolicy: 'JOIN_CODE',
      verificationCode: 'CAMPUS1',
    });
    apiService.getCommunityDashboard('comm-1');
    apiService.createQuestion('comm-1', { title: 'Where to meet?', body: 'Need a pickup point.' });
    apiService.createCampaign('comm-1', { title: 'Food drive', story: 'Collect food packets.' });
    apiService.createAnnouncement('comm-1', { title: 'Notice', body: 'Desk open.' });
    apiService.messageCommunityMember('comm-1', 'member-1');

    expect(mocks.client.get).toHaveBeenCalledWith('/communities', { params: { city: 'Delhi' } });
    expect(mocks.client.post).toHaveBeenCalledWith('/communities', expect.objectContaining({
      category: 'COLLEGE',
      address: 'Main gate',
      joinPolicy: 'JOIN_CODE',
      joinCode: 'CAMPUS1',
    }));
    expect(mocks.client.get).toHaveBeenCalledWith('/communities/comm-1/dashboard');
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-1/questions', { title: 'Where to meet?', body: 'Need a pickup point.' });
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-1/campaigns', { title: 'Food drive', story: 'Collect food packets.' });
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-1/announcements', { title: 'Notice', body: 'Desk open.' });
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-1/members/member-1/message');
  });

  it('uses nested community contracts for requests, Q&A, campaigns, members, and announcements', () => {
    apiService.createCommunityRequest('comm-2', {
      title: 'Need water',
      description: 'Route scoped only',
      communityId: 'spoofed-community',
    });
    apiService.createAnswer('comm-2', 'q-1', { body: 'Use gate A' });
    apiService.upvoteQuestion('comm-2', 'q-1');
    apiService.upvoteAnswer('comm-2', 'q-1', 'ans-1');
    apiService.acceptAnswer('comm-2', 'q-1', 'ans-1');
    apiService.contributeToCampaign('comm-2', 'camp-1', { type: 'MONEY_PLEDGE', amount: 25, note: 'External pledge' });
    apiService.updateCommunityMemberRole('comm-2', 'member-1', 'MODERATOR');
    apiService.removeCommunityMember('comm-2', 'member-2');
    apiService.togglePinAnnouncement('comm-2', 'ann-1');
    apiService.deleteAnnouncement('comm-2', 'ann-1');

    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-2/requests', expect.objectContaining({
      title: 'Need water',
      description: 'Route scoped only',
    }));
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-2/questions/q-1/answers', { body: 'Use gate A' });
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-2/questions/q-1/upvote');
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-2/questions/q-1/answers/ans-1/upvote');
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-2/questions/q-1/answers/ans-1/accept');
    expect(mocks.client.post).toHaveBeenCalledWith('/communities/comm-2/campaigns/camp-1/contributions', { type: 'MONEY_PLEDGE', amount: 25, note: 'External pledge' });
    expect(mocks.client.put).toHaveBeenCalledWith('/communities/comm-2/members/member-1/role', { role: 'MODERATOR' });
    expect(mocks.client.delete).toHaveBeenCalledWith('/communities/comm-2/members/member-2');
    expect(mocks.client.put).toHaveBeenCalledWith('/communities/comm-2/announcements/ann-1/pin');
    expect(mocks.client.delete).toHaveBeenCalledWith('/communities/comm-2/announcements/ann-1');
  });
});
