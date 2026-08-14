import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  acceptRequest: vi.fn(),
  addRequestComment: vi.fn(),
  createRequest: vi.fn(),
  getJoinedCommunities: vi.fn(),
  getOpenRequests: vi.fn(),
  getNearbyRequests: vi.fn(),
  getRequestById: vi.fn(),
  getRequestComments: vi.fn(),
  getRequestTimeline: vi.fn(),
  updateVolunteerRequestStatus: vi.fn(),
  requestCompletion: vi.fn(),
  verifyRequestCompletion: vi.fn(),
  rejectRequestCompletion: vi.fn(),
  withdrawRequest: vi.fn(),
  cancelRequest: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: {
    id: 'volunteer-1',
    userId: 'volunteer-1',
    fullName: 'Rahul Sharma',
    role: 'USER',
    isVolunteer: true,
    verified: true,
    city: 'Delhi',
    district: 'New Delhi',
    state: 'Delhi',
  },
}));

const notifications = vi.hoisted(() => ({
  showToast: vi.fn(),
  notifyRequestAccepted: vi.fn(),
  notifyRequestCreated: vi.fn(),
}));

vi.mock('../../services/api', () => ({ default: api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: () => notifications }));
vi.mock('../../components/LocationAutocompleteInput', () => ({
  default: ({ value, onValueChange, onLocationSelect, onSuggestionSelect: _onSuggestionSelect, ...props }) => (
    <input
      aria-label="Address / Location"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      onBlur={() => onLocationSelect?.({ address: value, city: 'Delhi', district: 'New Delhi', state: 'Delhi' })}
      {...props}
    />
  ),
}));

import Feed from '../Feed';
import CreateRequest from '../CreateRequest';
import RequestDetail from '../RequestDetail';

const request = {
  id: 'req-1',
  title: 'Urgent medicine delivery',
  description: 'Please pick up insulin from the pharmacy and deliver it to the ward desk.',
  category: 'MEDICAL',
  urgency: 'HIGH',
  status: 'OPEN',
  address: 'AIIMS Delhi',
  city: 'Delhi',
  district: 'New Delhi',
  state: 'Delhi',
  createdAt: new Date().toISOString(),
  distanceKm: 2.4,
  viewCount: 7,
  responseCount: 1,
  canAccept: true,
  requester: { id: 'requester-1', fullName: 'Priya Patel', verified: true, rating: 4.8 },
  community: { id: 'community-1', name: 'AIIMS Delhi' },
};

function renderAt(path, element) {
  const routePath = path.startsWith('/request/') ? '/request/:id' : path.split('?')[0];
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        {!path.startsWith('/request/') && <Route path="/request/:id" element={<div>request detail route</div>} />}
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getOpenRequests.mockResolvedValue({ data: [request] });
  api.getNearbyRequests.mockResolvedValue({ data: [request] });
  api.getJoinedCommunities.mockResolvedValue({ data: [{ id: 'community-1', name: 'AIIMS Delhi' }] });
  api.createRequest.mockResolvedValue({ data: { id: 'new-request' } });
  api.getRequestById.mockResolvedValue({ data: request });
  api.getRequestComments.mockResolvedValue({ data: [{ id: 'c1', text: 'I can help in 10 minutes.', authorName: 'Helper', createdAt: new Date().toISOString() }] });
  api.getRequestTimeline.mockResolvedValue({ data: [] });
  api.acceptRequest.mockResolvedValue({ data: { ...request, status: 'ACTIVE' } });
});

describe('Phase 7A request surfaces', () => {
  it('renders the redesigned feed and accepts an eligible request', async () => {
    renderAt('/feed', <Feed />);

    expect(await screen.findByText('Help Requests Near You')).toBeInTheDocument();
    expect(screen.getByText('Urgent medicine delivery')).toBeInTheDocument();
    const card = screen.getByText('Urgent medicine delivery').closest('.p7-request-card');
    expect(within(card).getByText('HIGH')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(api.acceptRequest).toHaveBeenCalledWith('req-1', auth.user));
    expect(notifications.notifyRequestAccepted).toHaveBeenCalled();
  });

  it('guides a request through create validation and submits canonical data', async () => {
    renderAt('/create', <CreateRequest />);

    expect(await screen.findByText('Tell Sahay what help is needed.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('Review these fields')).toBeInTheDocument();
    expect(screen.getAllByText('Use a short, meaningful title.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Describe the request in at least 20 characters.').length).toBeGreaterThanOrEqual(1);

    await userEvent.type(screen.getByLabelText(/Request title/i), 'Need medicine pickup');
    await userEvent.type(screen.getByLabelText(/Description/i), 'My father needs insulin picked up from the pharmacy near AIIMS.');
    await userEvent.selectOptions(screen.getByLabelText(/Category/i), 'MEDICAL');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await userEvent.click(screen.getByRole('button', { name: /High/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await userEvent.type(screen.getByLabelText(/Address \/ Location/i), 'AIIMS Delhi Gate 1');
    await userEvent.type(screen.getByLabelText(/^City/i), 'Delhi');
    await userEvent.type(screen.getByLabelText(/^District/i), 'New Delhi');
    await userEvent.type(screen.getByLabelText(/^State/i), 'Delhi');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => expect(api.createRequest).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Need medicine pickup',
      category: 'MEDICAL',
      urgency: 'HIGH',
      address: 'AIIMS Delhi Gate 1',
    }), auth.user));
    expect(notifications.notifyRequestCreated).toHaveBeenCalled();
  });

  it('renders request detail with lifecycle actions, timeline, and comments', async () => {
    renderAt('/request/req-1', <RequestDetail />);

    expect(await screen.findByText('Urgent medicine delivery')).toBeInTheDocument();
    expect(screen.getByText('Action Panel')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('I can help in 10 minutes.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /accept request/i }));
    await waitFor(() => expect(api.acceptRequest).toHaveBeenCalledWith('req-1', auth.user));
  });
});
