import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getCommunities: vi.fn(),
  getJoinedCommunities: vi.fn(),
  createCommunity: vi.fn(),
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  getCommunityDetail: vi.fn(),
  getCommunityDashboard: vi.fn(),
  getCommunityMembers: vi.fn(),
  getCommunityRequests: vi.fn(),
  listQuestions: vi.fn(),
  createQuestion: vi.fn(),
  createAnswer: vi.fn(),
  upvoteQuestion: vi.fn(),
  upvoteAnswer: vi.fn(),
  acceptAnswer: vi.fn(),
  listCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  contributeToCampaign: vi.fn(),
  getAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  messageCommunityMember: vi.fn(),
  updateCommunity: vi.fn(),
  updateCommunityMemberRole: vi.fn(),
  removeCommunityMember: vi.fn(),
  broadcastCommunityMessage: vi.fn(),
  deleteCommunity: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: { userId: 'u-current', id: 'u-current', role: 'USER' },
}));

const toasts = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('../../services/api', () => ({ default: api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    showToast: toasts.showToast,
    notifyCommunityJoined: vi.fn(),
    notifyCommunityCreated: vi.fn(),
  }),
}));
vi.mock('../../components/LocationAutocompleteInput', () => ({
  default: ({ value, onValueChange, ...props }) => (
    <input aria-label="Address or area" value={value} onChange={(event) => onValueChange(event.target.value)} {...props} />
  ),
}));

import Communities from '../Communities';
import CommunityDetail from '../CommunityDetail';
import CommunityManage from '../CommunityManage';

const community = {
  id: 'c1',
  name: 'Campus Helpers',
  category: 'COLLEGE',
  description: 'Verified campus help',
  location: 'North Gate',
  city: 'Delhi',
  state: 'Delhi',
  memberCount: 4,
  visibility: 'PUBLIC',
  joinPolicy: 'OPEN',
  membershipStatus: 'ACTIVE',
  currentUserRole: 'MEMBER',
};

const detailData = {
  dashboard: { data: { memberCount: 44, activeRequestCount: 7, openQuestionCount: 3, activeCampaignCount: 2 } },
  members: {
    data: [
      { id: 'm-current', userId: 'u-current', fullName: 'Current User', role: 'MEMBER', status: 'ACTIVE' },
      { id: 'm-other', userId: 'u-other', fullName: 'Other Member', role: 'ADMIN', status: 'ACTIVE' },
      { id: 'm-owner', userId: 'u-owner', fullName: 'Owner Person', role: 'OWNER', status: 'ACTIVE' },
    ],
  },
  requests: { data: [{ id: 'r1', title: 'Need books', description: 'For class', status: 'OPEN', requesterName: 'Current User' }] },
  questions: {
    data: [{
      id: 'q1',
      title: 'Where meet?',
      body: 'Pickup point?',
      answerCount: 1,
      upvoteCount: 2,
      authorName: 'Current User',
      userId: 'u-current',
      answers: [{ id: 'a1', body: 'At the library desk.', authorName: 'Other Member', upvoteCount: 1 }],
    }],
  },
  campaigns: { data: [{ id: 'camp1', title: 'Food drive', story: 'Collect packets', status: 'ACTIVE', category: 'FOOD_DRIVE', contributionCount: 5, targetAmount: 100, collectedAmount: 40 }] },
  announcements: { data: [{ id: 'ann1', title: 'Desk open', body: '5 PM', pinned: true, createdAt: new Date().toISOString() }] },
};

function mockDetail(overrides = {}) {
  api.getCommunityDetail.mockResolvedValue(overrides.detail || { data: community });
  api.getCommunityDashboard.mockResolvedValue(overrides.dashboard || detailData.dashboard);
  api.getCommunityMembers.mockResolvedValue(overrides.members || detailData.members);
  api.getCommunityRequests.mockResolvedValue(overrides.requests || detailData.requests);
  api.listQuestions.mockResolvedValue(overrides.questions || detailData.questions);
  api.listCampaigns.mockResolvedValue(overrides.campaigns || detailData.campaigns);
  api.getAnnouncements.mockResolvedValue(overrides.announcements || detailData.announcements);
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}{location.search}</div>;
}

function renderCommunities() {
  return render(
    <MemoryRouter initialEntries={['/communities']}>
      <Routes>
        <Route path="/communities" element={<Communities />} />
        <Route path="/community/:id" element={<div>community detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderDetail(id = 'c1') {
  return render(
    <MemoryRouter initialEntries={[`/community/${id}`]}>
      <Routes>
        <Route path="/community/:id" element={<><CommunityDetail /><LocationProbe /></>} />
        <Route path="/community/:id/manage" element={<><CommunityManage /><LocationProbe /></>} />
        <Route path="/communities" element={<><div>communities page</div><LocationProbe /></>} />
        <Route path="/create" element={<><div>create request page</div><LocationProbe /></>} />
        <Route path="/chats" element={<><div>chat route</div><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderManage() {
  return render(
    <MemoryRouter initialEntries={['/community/c1/manage']}>
      <Routes>
        <Route path="/community/:id/manage" element={<CommunityManage />} />
        <Route path="/community/:id" element={<div>detail</div>} />
        <Route path="/communities" element={<div>communities</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function RouteSwapHarness() {
  const [entry, setEntry] = React.useState('/community/a');
  return (
    <MemoryRouter key={entry} initialEntries={[entry]}>
      <button onClick={() => setEntry('/community/b')}>Go B</button>
      <Routes><Route path="/community/:id" element={<CommunityDetail />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { userId: 'u-current', id: 'u-current', role: 'USER' };
  toasts.showToast.mockReset();
});

describe('Phase 7B community discovery and creation', () => {
  it('renders redesigned loading, backend cards, filters, empty state, and safe errors', async () => {
    let resolveCommunities;
    api.getCommunities.mockReturnValue(new Promise((resolve) => { resolveCommunities = resolve; }));
    api.getJoinedCommunities.mockResolvedValue({ data: [] });

    renderCommunities();
    expect(document.querySelector('.p7b-community-grid')).toBeInTheDocument();
    resolveCommunities({ data: [community] });

    expect(await screen.findByRole('heading', { name: 'Campus Helpers' })).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getAllByText('Public').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText(/Search communities/i), 'clinic');
    await waitFor(() => expect(api.getCommunities).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'clinic' })));

    api.getCommunities.mockResolvedValueOnce({ data: [] });
    await userEvent.selectOptions(screen.getAllByLabelText('Category')[0], 'HOSPITAL');
    await waitFor(() => expect(api.getCommunities).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'HOSPITAL' })));
    expect(await screen.findByText(/No communities found/i)).toBeInTheDocument();

    api.getCommunities.mockRejectedValueOnce(new Error('java.lang.IllegalStateException stack'));
    await userEvent.selectOptions(screen.getAllByLabelText('Visibility')[0], 'PRIVATE');
    expect(await screen.findByRole('alert')).toHaveTextContent('Communities could not load');
    expect(screen.queryByText(/java.lang/i)).not.toBeInTheDocument();
  });

  it('uses guided create sections, policy-specific fields, review, duplicate-submit guard, and canonical payload', async () => {
    api.getCommunities.mockResolvedValue({ data: [] });
    api.getJoinedCommunities.mockResolvedValue({ data: [] });
    api.createCommunity.mockResolvedValue({ data: { ...community, id: 'new-community', name: 'New Campus' } });
    renderCommunities();

    await userEvent.click(await screen.findByRole('button', { name: /Create Community/i }));
    await userEvent.type(screen.getByLabelText(/Community name/i), 'New Campus');
    await userEvent.type(screen.getByLabelText(/Purpose/i), 'A verified student support space.');
    await userEvent.click(screen.getByRole('button', { name: /Next/i }));
    await userEvent.type(screen.getByLabelText(/Address or area/i), 'Main Gate');
    await userEvent.click(screen.getByRole('button', { name: /Next/i }));
    await userEvent.click(screen.getByRole('button', { name: /Private/i }));
    await userEvent.click(screen.getByRole('button', { name: /Next/i }));
    await userEvent.click(screen.getByRole('button', { name: /Join code/i }));
    await userEvent.type(screen.getByLabelText(/Join code/i), 'SAFE123');
    await userEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText('Configured')).toBeInTheDocument();

    const submit = screen.getAllByRole('button', { name: /^Create community$/i }).at(-1);
    await userEvent.dblClick(submit);
    await waitFor(() => expect(api.createCommunity).toHaveBeenCalledTimes(1));
    expect(api.createCommunity.mock.calls[0][0]).toEqual(expect.objectContaining({
      name: 'New Campus',
      joinPolicy: 'JOIN_CODE',
      verificationCode: 'SAFE123',
      visibility: 'PRIVATE',
    }));
    expect(api.createCommunity.mock.calls[0][0]).not.toHaveProperty('role');
  });

  it('handles join code and pending membership states without raw backend errors', async () => {
    api.getCommunities.mockResolvedValue({ data: [{ ...community, membershipStatus: null, currentUserRole: null, joinPolicy: 'JOIN_CODE' }] });
    api.getJoinedCommunities.mockResolvedValue({ data: [] });
    api.joinCommunity.mockRejectedValueOnce(new Error('403 java.lang.BadCredentials'));
    renderCommunities();

    await userEvent.click(await screen.findByRole('button', { name: 'Join' }));
    fireEvent.change(screen.getByLabelText(/Join code/i), { target: { value: 'BAD' } });
    await userEvent.click(screen.getByRole('button', { name: /Join community/i }));
    await waitFor(() => expect(api.joinCommunity).toHaveBeenCalledWith('c1', 'BAD', 'u-current'));
    expect(toasts.showToast.mock.calls.at(-1)[0].message).toBe('Unable to join this community.');

    api.joinCommunity.mockResolvedValueOnce({ data: { status: 'PENDING' } });
    await userEvent.click(screen.getByRole('button', { name: /Join community/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Phase 7B community detail', () => {
  it('renders hero, dashboard counts, requests, Q&A, accepted answers, campaign pledge wording, and announcements', async () => {
    mockDetail();
    api.createQuestion.mockResolvedValue({ data: { id: 'q2' } });
    api.upvoteQuestion.mockResolvedValue({ data: {} });
    api.acceptAnswer.mockResolvedValue({ data: {} });
    api.createCampaign.mockResolvedValue({ data: { id: 'camp2' } });
    api.contributeToCampaign.mockResolvedValue({ data: { id: 'pledge1' } });
    renderDetail();

    expect(await screen.findAllByText('Campus Helpers')).toHaveLength(2);
    expect(screen.getByText('44 members')).toBeInTheDocument();
    expect(screen.getByText('7 requests')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Requests' }));
    expect(screen.getByText('Need books')).toBeInTheDocument();
    expect(screen.getByText('Community scoped')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Q&A' }));
    await userEvent.click(screen.getByRole('button', { name: /Ask question/i }));
    const questionDialog = screen.getByRole('dialog', { name: /Ask question/i });
    await userEvent.type(within(questionDialog).getByLabelText(/Question title/i), 'Need water?');
    await userEvent.type(within(questionDialog).getByLabelText(/Details/i), 'Where can we collect bottles?');
    await userEvent.click(within(questionDialog).getByRole('button', { name: /Ask question/i }));
    await waitFor(() => expect(api.createQuestion).toHaveBeenCalledWith('c1', { title: 'Need water?', body: 'Where can we collect bottles?' }));

    await userEvent.click(screen.getByRole('button', { name: /Where meet/i }));
    expect(screen.getByText('At the library desk.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Accept answer/i }));
    await waitFor(() => expect(api.acceptAnswer).toHaveBeenCalledWith('c1', 'q1', 'a1'));

    await userEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));
    expect(screen.getByText('Food drive')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Open campaign/i }));
    expect(screen.getByText(/No payment is processed here/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Record contribution pledge/i }));
    expect(screen.getByText(/Pledge only/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Details/i), { target: { value: 'Can bring ten packets.' } });
    await userEvent.click(screen.getByRole('button', { name: /Record pledge/i }));
    await waitFor(() => expect(api.contributeToCampaign).toHaveBeenCalledWith('c1', 'camp1', expect.objectContaining({ details: 'Can bring ten packets.' })));

    await userEvent.click(screen.getByRole('tab', { name: 'Announcements' }));
    expect(screen.getByText('Desk open')).toBeInTheDocument();
    expect(screen.queryByText(/Payment successful/i)).not.toBeInTheDocument();
  });

  it('renders member messaging, hides self-message, and blocks non-member module controls', async () => {
    mockDetail();
    api.messageCommunityMember.mockResolvedValue({ data: { id: 'room-1' } });
    renderDetail();

    await screen.findAllByText('Campus Helpers');
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }));
    expect(within(screen.getByText('Current User').closest('.p7b-member-card')).queryByRole('button', { name: /Message/i })).not.toBeInTheDocument();
    await userEvent.click(within(screen.getByText('Other Member').closest('.p7b-member-card')).getByRole('button', { name: /Message/i }));
    await waitFor(() => expect(api.messageCommunityMember).toHaveBeenCalledWith('c1', 'm-other'));
    expect(await screen.findByTestId('path')).toHaveTextContent('/chats');

    mockDetail({ detail: { data: { ...community, membershipStatus: null, currentUserRole: null } } });
    renderDetail('c2');
    await screen.findByText('Community preview');
    await userEvent.click(screen.getByRole('tab', { name: 'Q&A' }));
    expect(screen.queryByRole('button', { name: /Ask question/i })).not.toBeInTheDocument();
  });

  it('clears delayed Community A state when navigating to Community B', async () => {
    let resolveA;
    api.getCommunityDetail.mockImplementation((communityId) => communityId === 'a'
      ? new Promise((resolve) => { resolveA = resolve; })
      : Promise.resolve({ data: { ...community, id: 'b', name: 'Community B', membershipStatus: null, currentUserRole: null } }));
    api.getCommunityDashboard.mockResolvedValue({ data: null });
    api.getCommunityMembers.mockResolvedValue({ data: [] });
    api.getCommunityRequests.mockResolvedValue({ data: [] });
    api.listQuestions.mockResolvedValue({ data: [] });
    api.listCampaigns.mockResolvedValue({ data: [] });
    api.getAnnouncements.mockResolvedValue({ data: [] });

    render(<RouteSwapHarness />);
    expect(document.querySelector('.ui-skeleton')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Go B'));
    expect(await screen.findAllByText('Community B')).toHaveLength(2);
    resolveA({ data: { ...community, id: 'a', name: 'Community A' } });
    await waitFor(() => expect(screen.queryByText('Community A')).not.toBeInTheDocument());
  });
});

describe('Phase 7B community management', () => {
  it('updates settings, join policy, member roles, announcements, broadcasts, and destructive confirmations', async () => {
    auth.user = { userId: 'u-current', id: 'u-current', role: 'ADMIN' };
    mockDetail({ detail: { data: { ...community, currentUserRole: 'ADMIN' } } });
    api.updateCommunity.mockResolvedValue({ data: { ...community, name: 'Campus Helpers Plus' } });
    api.updateCommunityMemberRole.mockResolvedValue({ data: {} });
    api.removeCommunityMember.mockResolvedValue({ data: {} });
    api.createAnnouncement.mockResolvedValue({ data: { id: 'ann2' } });
    api.broadcastCommunityMessage.mockResolvedValue({ data: {} });
    api.deleteCommunity.mockResolvedValue({ data: {} });
    renderManage();

    expect(await screen.findByRole('heading', { name: 'Campus Helpers' })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Community name/i));
    await userEvent.type(screen.getByLabelText(/Community name/i), 'Campus Helpers Plus');
    await userEvent.click(screen.getByRole('button', { name: /Save settings/i }));
    await waitFor(() => expect(api.updateCommunity).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Campus Helpers Plus' })));

    await userEvent.click(screen.getByRole('tab', { name: 'Access' }));
    await userEvent.selectOptions(screen.getByLabelText(/Join policy/i), 'EMAIL_DOMAIN');
    await userEvent.type(screen.getByLabelText(/Allowed email domain/i), 'college.edu');
    await userEvent.click(screen.getByRole('button', { name: /Save access policy/i }));
    await waitFor(() => expect(api.updateCommunity).toHaveBeenLastCalledWith('c1', expect.objectContaining({ joinPolicy: 'EMAIL_DOMAIN', emailDomain: 'college.edu' })));

    await userEvent.click(screen.getByRole('tab', { name: /Members/ }));
    expect(screen.getByText('Owner protected')).toBeInTheDocument();
    await userEvent.selectOptions(within(screen.getByText('Other Member').closest('.p7b-member-row')).getByRole('combobox'), 'MODERATOR');
    await waitFor(() => expect(api.updateCommunityMemberRole).toHaveBeenCalledWith('c1', 'm-other', 'MODERATOR'));
    await userEvent.click(within(screen.getByText('Other Member').closest('.p7b-member-row')).getByRole('button', { name: /Remove/i }));
    await userEvent.click(screen.getByRole('button', { name: /^Remove member$/i }));
    await waitFor(() => expect(api.removeCommunityMember).toHaveBeenCalledWith('c1', 'm-other'));

    await userEvent.click(screen.getByRole('tab', { name: 'Announcements' }));
    await userEvent.type(screen.getAllByLabelText('Title')[0], 'Safety note');
    await userEvent.type(screen.getAllByLabelText('Message')[0], 'Use verified desks.');
    await userEvent.click(screen.getByRole('button', { name: /Post announcement/i }));
    await waitFor(() => expect(api.createAnnouncement).toHaveBeenCalledWith('c1', { title: 'Safety note', body: 'Use verified desks.' }));
    await userEvent.type(screen.getAllByLabelText('Title')[1], 'Broadcast');
    await userEvent.type(screen.getAllByLabelText('Message')[1], 'Important update.');
    await userEvent.click(screen.getByRole('button', { name: /Send broadcast/i }));
    await waitFor(() => expect(api.broadcastCommunityMessage).toHaveBeenCalledWith('c1', expect.objectContaining({ title: 'Broadcast', content: 'Important update.' })));

    await userEvent.click(screen.getByRole('tab', { name: 'Danger Zone' }));
    expect(screen.queryByRole('button', { name: /^Delete community$/i })).not.toBeInTheDocument();
  });
});
