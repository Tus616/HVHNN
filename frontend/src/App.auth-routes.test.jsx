import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import apiService from './services/api';
import { signOutFirebaseUser } from './services/firebase';

vi.mock('./services/api', () => ({
  default: {
    getProfile: vi.fn(),
    completeOnboarding: vi.fn(),
    login: vi.fn(),
    verifyRegistration: vi.fn(),
    loginWithFirebase: vi.fn(),
    getNotifications: vi.fn(),
    getNotificationUnreadCount: vi.fn(),
  },
}));

vi.mock('./services/firebase', () => ({
  completeEmailLinkSignIn: vi.fn(),
  isEmailLinkSignIn: vi.fn(() => false),
  sendAuthenticationLink: vi.fn(),
  signInWithGooglePopup: vi.fn(),
  signOutFirebaseUser: vi.fn(() => Promise.resolve()),
  requestFirebaseMessagingToken: vi.fn(() => Promise.resolve('')),
  subscribeForegroundMessages: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('sockjs-client/dist/sockjs', () => ({
  default: vi.fn(),
}));

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation(() => ({
    activate: vi.fn(),
    deactivate: vi.fn(),
    subscribe: vi.fn(),
  })),
}));

vi.mock('./pages/Landing', () => ({ default: () => <div>Landing Screen</div> }));
vi.mock('./pages/Login', () => ({ default: () => <div>Login Screen</div> }));
vi.mock('./pages/Register', () => ({ default: () => <div>Register Screen</div> }));
vi.mock('./pages/Feed', () => ({ default: () => <main>Help Feed Screen</main> }));
vi.mock('./pages/CreateRequest', () => ({ default: () => <div>Create Request Screen</div> }));
vi.mock('./pages/RequestDetail', () => ({ default: () => <div>Request Detail Screen</div> }));
vi.mock('./pages/MyRequests', () => ({ default: () => <div>My Requests Screen</div> }));
vi.mock('./pages/Profile', () => ({ default: () => <div>Profile Screen</div> }));
vi.mock('./pages/Leaderboard', () => ({ default: () => <div>Leaderboard Screen</div> }));
vi.mock('./pages/Chats', () => ({ default: () => <div>Chats Screen</div> }));
vi.mock('./pages/EditProfile', () => ({ default: () => <div>Edit Profile Screen</div> }));
vi.mock('./pages/Communities', () => ({ default: () => <div>Communities Screen</div> }));
vi.mock('./pages/CommunityDetail', () => ({ default: () => <div>Community Detail Screen</div> }));
vi.mock('./pages/CommunityManage', () => ({ default: () => <div>Community Manage Screen</div> }));
vi.mock('./pages/VolunteerDashboard', () => ({ default: () => <div>Volunteer Dashboard Screen</div> }));
vi.mock('./pages/VolunteerSettings', () => ({ default: () => <div>Volunteer Settings Screen</div> }));
vi.mock('./pages/Settings', () => ({ default: () => <div>Settings Screen</div> }));
vi.mock('./pages/PublicRequest', () => ({ default: () => <div>Public Request Screen</div> }));
vi.mock('./pages/AiPlayground', () => ({ default: () => <div>AI Playground Screen</div> }));
vi.mock('./components/Footer', () => ({ default: () => <footer>Footer</footer> }));
vi.mock('./components/ToastContainer', () => ({ default: () => null }));
vi.mock('./hooks/useBookmarks', () => ({ default: () => ({ bookmarks: [] }) }));

const incompleteUser = {
  id: 'user-1',
  userId: 'user-1',
  email: 'tester@hvhn.test',
  fullName: 'Test User',
  phone: '9999999999',
  role: 'USER',
  token: 'stored.jwt',
  onboardingCompleted: false,
  isVolunteer: false,
  volunteerCategories: [],
};

const completeUser = {
  ...incompleteUser,
  onboardingCompleted: true,
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function storeSession(user = completeUser, token = 'stored.jwt', expiry = Date.now() + 60_000) {
  window.localStorage.setItem('hvhn_token', token);
  window.localStorage.setItem('token', token);
  window.localStorage.setItem('hvhn_user', JSON.stringify({ ...user, token }));
  window.localStorage.setItem('hvhn_session_expiry', String(expiry));
}

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AccessibilityProvider>
          <AuthProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AuthProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  apiService.getProfile.mockResolvedValue({ data: completeUser });
  apiService.completeOnboarding.mockResolvedValue({ data: completeUser });
  apiService.getNotifications.mockResolvedValue({ data: { notifications: [] } });
  apiService.getNotificationUnreadCount.mockResolvedValue({ data: { unreadCount: 0 } });
});

afterEach(() => {
  window.localStorage.clear();
});

describe('auth initialization and protected routes', () => {
  it('keeps protected content hidden while session validation is pending', async () => {
    const profile = deferred();
    storeSession(completeUser);
    apiService.getProfile.mockReturnValue(profile.promise);

    renderApp('/feed');

    expect(screen.getByText('', { selector: '.spinner' })).toBeInTheDocument();
    expect(screen.queryByText('Help Feed Screen')).not.toBeInTheDocument();

    await act(async () => profile.resolve({ data: completeUser }));
    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
  });

  it('restores a valid session and clears invalid or expired sessions', async () => {
    storeSession(completeUser);
    renderApp('/feed');
    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
    expect(window.localStorage.getItem('hvhn_token')).toBe('stored.jwt');

    cleanup();
    window.localStorage.clear();
    apiService.getProfile.mockRejectedValueOnce(new Error('temporary outage'));
    storeSession(completeUser);
    renderApp('/feed');
    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
    expect(window.localStorage.getItem('hvhn_token')).toBe('stored.jwt');

    cleanup();
    window.localStorage.clear();
    const unauthorized = new Error('unauthorized');
    unauthorized.response = { status: 401 };
    apiService.getProfile.mockRejectedValueOnce(unauthorized);
    storeSession(completeUser);
    renderApp('/feed');
    expect(await screen.findByText('Login Screen')).toBeInTheDocument();
    expect(window.localStorage.getItem('hvhn_token')).toBeNull();

    cleanup();
    window.localStorage.clear();
    storeSession(completeUser, 'expired.jwt', Date.now() - 1);
    renderApp('/feed');
    expect(await screen.findByText('Login Screen')).toBeInTheDocument();
    expect(window.localStorage.getItem('hvhn_token')).toBeNull();
  });

  it('routes protected pages by authentication and onboarding state without loops', async () => {
    apiService.getProfile.mockResolvedValue({ data: incompleteUser });
    storeSession(incompleteUser);
    renderApp('/feed');
    expect(await screen.findByText('Complete Your Sahay Profile')).toBeInTheDocument();
    expect(screen.queryByText('Help Feed Screen')).not.toBeInTheDocument();

    cleanup();
    window.localStorage.clear();
    storeSession(completeUser);
    apiService.getProfile.mockResolvedValue({ data: completeUser });
    renderApp('/feed');
    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
  });

  it('redirects unauthenticated protected routes to login', async () => {
    renderApp('/feed');
    expect(await screen.findByText('Login Screen')).toBeInTheDocument();

    cleanup();
    renderApp('/onboarding');
    expect(await screen.findByText('Login Screen')).toBeInTheDocument();
  });
});

describe('public and onboarding routes', () => {
  it('allows public login/register for guests and redirects authenticated users by onboarding state', async () => {
    renderApp('/login');
    expect(await screen.findByText('Login Screen')).toBeInTheDocument();

    cleanup();
    window.localStorage.clear();
    apiService.getProfile.mockResolvedValue({ data: incompleteUser });
    storeSession(incompleteUser);
    renderApp('/login');
    expect(await screen.findByText('Complete Your Sahay Profile')).toBeInTheDocument();

    cleanup();
    window.localStorage.clear();
    apiService.getProfile.mockResolvedValue({ data: completeUser });
    storeSession(completeUser);
    renderApp('/register');
    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
  });

  it('keeps completed users out of onboarding and lets incomplete users open it', async () => {
    apiService.getProfile.mockResolvedValue({ data: incompleteUser });
    storeSession(incompleteUser);
    renderApp('/onboarding');
    expect(await screen.findByText('Complete Your Sahay Profile')).toBeInTheDocument();

    cleanup();
    window.localStorage.clear();
    apiService.getProfile.mockResolvedValue({ data: completeUser });
    storeSession(completeUser);
    renderApp('/onboarding');
    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
  });
});

describe('onboarding submission and volunteer rules', () => {
  it('updates auth state and redirects after successful onboarding with volunteer disabled', async () => {
    apiService.getProfile.mockResolvedValue({ data: incompleteUser });
    apiService.completeOnboarding.mockResolvedValue({ data: completeUser });
    storeSession(incompleteUser);
    renderApp('/onboarding');

    await screen.findByText('Complete Your Sahay Profile');
    await userEvent.click(screen.getByRole('button', { name: /finish onboarding/i }));

    await waitFor(() => expect(apiService.completeOnboarding).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'Test User',
      phone: '9999999999',
      volunteerEnabled: false,
      volunteerCategories: [],
    })));
    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('hvhn_user')).onboardingCompleted).toBe(true);
  });

  it('shows validation errors and keeps the user on the form when submission fails', async () => {
    apiService.getProfile.mockResolvedValue({ data: { ...incompleteUser, fullName: '', phone: '' } });
    storeSession({ ...incompleteUser, fullName: '', phone: '' });
    const { container } = renderApp('/onboarding');

    await screen.findByText('Complete Your Sahay Profile');
    await userEvent.click(screen.getByRole('button', { name: /finish onboarding/i }));
    expect(screen.getByText('Full name and phone are required.')).toBeInTheDocument();
    expect(apiService.completeOnboarding).not.toHaveBeenCalled();

    const inputs = container.querySelectorAll('input.form-input');
    fireEvent.change(inputs[0], { target: { value: 'Test User' } });
    fireEvent.change(inputs[1], { target: { value: '9999999999' } });
    apiService.completeOnboarding.mockRejectedValueOnce(new Error('Server validation failed.'));
    await userEvent.click(screen.getByRole('button', { name: /finish onboarding/i }));

    expect(await screen.findByText('Server validation failed.')).toBeInTheDocument();
    expect(screen.getByText('Complete Your Sahay Profile')).toBeInTheDocument();
  });

  it('prevents duplicate submit while pending', async () => {
    const save = deferred();
    apiService.getProfile.mockResolvedValue({ data: incompleteUser });
    apiService.completeOnboarding.mockReturnValue(save.promise);
    storeSession(incompleteUser);
    renderApp('/onboarding');

    await screen.findByText('Complete Your Sahay Profile');
    const submit = screen.getByRole('button', { name: /finish onboarding/i });
    await userEvent.click(submit);
    await userEvent.click(submit);

    expect(apiService.completeOnboarding).toHaveBeenCalledTimes(1);
    await act(async () => save.resolve({ data: completeUser }));
  });

  it('requires volunteer categories when enabled and sends canonical values', async () => {
    apiService.getProfile.mockResolvedValue({ data: incompleteUser });
    apiService.completeOnboarding.mockResolvedValue({ data: { ...completeUser, isVolunteer: true, volunteerCategories: ['BLOOD_DONATION'] } });
    storeSession(incompleteUser);
    renderApp('/onboarding');

    await screen.findByText('Complete Your Sahay Profile');
    await userEvent.click(screen.getByRole('checkbox', { name: /set me up as a volunteer/i }));
    await userEvent.click(screen.getByRole('button', { name: /finish onboarding/i }));
    expect(screen.getByText('Choose at least one volunteer category or continue as a normal member.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /blood donation/i }));
    await userEvent.click(screen.getByRole('button', { name: /finish onboarding/i }));

    await waitFor(() => expect(apiService.completeOnboarding).toHaveBeenCalledWith(expect.objectContaining({
      volunteerEnabled: true,
      volunteerCategories: ['BLOOD_DONATION'],
    })));
  });

  it('does not reset onboarding when volunteer mode is disabled later', async () => {
    apiService.getProfile.mockResolvedValue({ data: { ...completeUser, isVolunteer: true, volunteerCategories: ['MEDICAL'] } });
    storeSession({ ...completeUser, isVolunteer: true, volunteerCategories: ['MEDICAL'] });
    renderApp('/onboarding');

    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('hvhn_user')).onboardingCompleted).toBe(true);
  });
});

describe('logout', () => {
  it('clears token, user state, and Firebase sign-out without leaving stale protected content', async () => {
    storeSession(completeUser);
    apiService.getProfile.mockResolvedValue({ data: completeUser });
    renderApp('/feed');

    expect(await screen.findByText('Help Feed Screen')).toBeInTheDocument();
    const sidebar = screen.getByRole('complementary');
    await userEvent.click(within(sidebar).getByRole('button', { name: /logout/i }));

    await waitFor(() => expect(window.localStorage.getItem('hvhn_token')).toBeNull());
    expect(signOutFirebaseUser).toHaveBeenCalled();
    expect(await screen.findByText('Login Screen')).toBeInTheDocument();
    expect(screen.queryByText('Help Feed Screen')).not.toBeInTheDocument();
  });
});
