import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from '../Profile';
import EditProfile from '../EditProfile';
import VolunteerSettings from '../VolunteerSettings';
import Settings from '../Settings';
import AdminOverviewPage from '../admin/AdminOverviewPage';
import AdminUsersPage from '../admin/AdminUsersPage';

const auth = vi.hoisted(() => ({
  user: {
    userId: 'user-1',
    fullName: 'Asha Rao',
    email: 'asha@example.com',
    isVolunteer: false,
    volunteerCategories: [],
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.61,
    longitude: 77.2,
  },
  updateUser: vi.fn(),
  logout: vi.fn(),
}));

const api = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  getMyRequests: vi.fn(),
  getVolunteeredRequests: vi.fn(),
  getCommunities: vi.fn(),
  getJoinedCommunities: vi.fn(),
  getUserImpact: vi.fn(),
  getVolunteerStats: vi.fn(),
  toggleVolunteer: vi.fn(),
  updateVolunteerCategories: vi.fn(),
  updateVolunteerAvailability: vi.fn(),
  updateVolunteerLocation: vi.fn(),
  updateVolunteerSchedule: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  listNotificationDevices: vi.fn(),
  deleteNotificationDevice: vi.fn(),
}));

const admin = vi.hoisted(() => ({
  getOverview: vi.fn(),
  getRecentRequests: vi.fn(),
  getUsers: vi.fn(),
  verifyUser: vi.fn(),
  toggleBlockUser: vi.fn(),
  assignVolunteerBadge: vi.fn(),
}));

const notifications = vi.hoisted(() => ({
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
  pushPermission: 'granted',
  showToast: vi.fn(),
}));

vi.mock('../../services/api', () => ({ default: api }));
vi.mock('../../services/adminApi', () => ({ adminApi: admin }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../context/AccessibilityContext', () => ({
  useAccessibility: () => ({
    isDyslexic: false,
    toggleDyslexia: vi.fn(),
    isHighContrast: false,
    toggleHighContrast: vi.fn(),
    isLargeText: false,
    toggleLargeText: vi.fn(),
  }),
}));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: () => notifications }));

function renderRoute(element) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

function renderAdmin(element) {
  const context = {
    user: auth.user,
    adminRole: 'SUPER_ADMIN',
    isSuperAdmin: true,
    showToast: vi.fn(),
  };
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route index element={element} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = {
    userId: 'user-1',
    fullName: 'Asha Rao',
    email: 'asha@example.com',
    isVolunteer: false,
    volunteerCategories: [],
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.61,
    longitude: 77.2,
  };
  api.getProfile.mockResolvedValue({ data: { ...auth.user, bio: 'Community coordinator', verified: true, createdAt: '2026-01-02T00:00:00Z' } });
  api.getMyRequests.mockResolvedValue({ data: [{ id: 'req-1', title: 'Need transport', status: 'OPEN', createdAt: '2026-08-01T10:00:00Z' }] });
  api.getVolunteeredRequests.mockResolvedValue({ data: [] });
  api.getCommunities.mockResolvedValue({ data: [{ id: 'comm-1', name: 'Delhi Helpers', address: 'Delhi' }] });
  api.getJoinedCommunities.mockResolvedValue({ data: ['comm-1'] });
  api.getUserImpact.mockResolvedValue({ data: { totalPeopleHelped: 0 } });
  api.updateProfile.mockResolvedValue({ data: { ...auth.user, fullName: 'Asha R' } });
  api.getVolunteerStats.mockResolvedValue({ data: { totalHelped: 2, rating: 4.5, rank: 3 } });
  api.toggleVolunteer.mockResolvedValue({ data: { isVolunteer: true } });
  api.updateVolunteerCategories.mockResolvedValue({ data: { volunteerCategories: ['MEDICAL'] } });
  api.updateVolunteerAvailability.mockResolvedValue({ data: { volunteerStatus: 'ONLINE' } });
  api.updateVolunteerLocation.mockResolvedValue({ data: {} });
  api.updateVolunteerSchedule.mockResolvedValue({ data: {} });
  api.getNotificationPreferences.mockResolvedValue({ data: { pushEnabled: true, quietHoursEnabled: true } });
  api.updateNotificationPreferences.mockResolvedValue({ data: { pushEnabled: true } });
  api.listNotificationDevices.mockResolvedValue({ data: [{ id: 'dev-1', platform: 'WEB', browser: 'Chrome', lastUsedAt: '2026-08-01T10:00:00Z' }] });
  api.deleteNotificationDevice.mockResolvedValue({ data: {} });
  admin.getOverview.mockResolvedValue({ data: { totalRequestsToday: 2, activeVolunteers: 4, pendingRequests: 1, resolvedRequests: 3, totalMembers: 8 }, fallback: false });
  admin.getRecentRequests.mockResolvedValue({ data: [{ id: 'req-1', category: 'BLOOD_DONATION', urgency: 'HIGH', status: 'PENDING', raisedBy: 'Asha', createdAt: '2026-08-01T10:00:00Z' }], fallback: false });
  admin.getUsers.mockResolvedValue({ data: { items: [], page: 0, totalPages: 1, totalItems: 0 } });
});

describe('Phase 7D profile and settings', () => {
  it('renders backend profile data safely without raw coordinate values', async () => {
    renderRoute(<Profile />);
    expect((await screen.findAllByRole('heading', { name: /asha rao/i })).length).toBeGreaterThan(0);
    expect(screen.getByText(/community coordinator/i)).toBeInTheDocument();
    expect(screen.getByText(/requests created/i)).toBeInTheDocument();
    expect(screen.queryByText('28.61')).not.toBeInTheDocument();
    expect(screen.queryByText('77.2')).not.toBeInTheDocument();
  });

  it('validates edit profile, handles permission denied, and saves populated fields', async () => {
    const geolocation = {
      getCurrentPosition: vi.fn((_success, error) => error(new Error('denied'))),
    };
    vi.stubGlobal('navigator', { ...navigator, geolocation });
    renderRoute(<EditProfile />);

    const name = await screen.findByLabelText(/display name/i);
    fireEvent.change(name, { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));
    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /use current location/i }));
    expect(await screen.findByText(/permission was denied/i)).toBeInTheDocument();

    fireEvent.change(name, { target: { value: 'Asha R' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Asha R' })));
    vi.unstubAllGlobals();
  });

  it('disables volunteer categories when off and saves canonical category mapping when enabled', async () => {
    renderRoute(<VolunteerSettings />);
    expect(await screen.findByRole('heading', { name: /volunteer settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /medical/i })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/volunteer mode off/i));
    fireEvent.click(screen.getByRole('button', { name: /medical/i }));
    fireEvent.click(screen.getByRole('button', { name: /save volunteer settings/i }));
    await waitFor(() => expect(api.updateVolunteerCategories).toHaveBeenCalledWith('user-1', ['MEDICAL']));
  });

  it('integrates location, volunteer, notifications, devices, account, and accessibility settings', async () => {
    auth.user = { ...auth.user, isVolunteer: true, volunteerCategories: ['BLOOD_DONATION'] };
    renderRoute(<Settings />);
    expect(await screen.findByRole('heading', { name: /preferences and account/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /location/i }));
    expect(screen.getByText(/use edit profile to update, refresh, or clear your saved location/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /volunteer/i }));
    expect(screen.getByText(/Blood Donation/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /devices/i }));
    expect(screen.getByText(/browsers that can receive sahay push notifications/i)).toBeInTheDocument();
    expect(screen.queryByText(/fcm/i)).not.toBeInTheDocument();
  });
});

describe('Phase 7D admin polish', () => {
  it('renders overview with real count labels and human-readable categories', async () => {
    renderAdmin(<AdminOverviewPage />);
    expect(await screen.findByText('Requests Today')).toBeInTheDocument();
    expect(screen.getByText('Blood Donation')).toBeInTheDocument();
    expect(screen.queryByText(/up 23/i)).not.toBeInTheDocument();
  });

  it('shows admin users empty state and supports safe error state', async () => {
    renderAdmin(<AdminUsersPage />);
    expect(await screen.findByText(/No users match these filters/i)).toBeInTheDocument();

    admin.getUsers.mockRejectedValueOnce(new Error('java.lang.IllegalStateException stack'));
    renderAdmin(<AdminUsersPage />);
    expect(await screen.findByText(/could not load admin users/i)).toBeInTheDocument();
  });

  it('uses a confirmation before blocking users', async () => {
    admin.getUsers.mockResolvedValueOnce({
      data: {
        page: 0,
        totalPages: 1,
        totalItems: 1,
        items: [{ id: 'u2', fullName: 'Nikhil Sen', email: 'nikhil@example.com', role: 'USER', community: 'Sahay', verified: true, blocked: false, badge: 'Member', status: 'VERIFIED', joinedDate: '2026-01-01T00:00:00Z' }],
      },
    });
    admin.toggleBlockUser.mockResolvedValue({ success: true });
    renderAdmin(<AdminUsersPage />);

    const row = await screen.findByText('Nikhil Sen');
    const actions = within(row.closest('tr')).getByText('Actions');
    fireEvent.click(actions);
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    expect(screen.getByRole('dialog', { name: /block user/i })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog', { name: /block user/i })).getByRole('button', { name: /^Block$/ }));
    await waitFor(() => expect(admin.toggleBlockUser).toHaveBeenCalledWith('u2', false));
  });
});
