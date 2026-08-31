import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import { Button, Card, ErrorState, PageHeader, Spinner } from './components/ui';
import AdminLayout from './components/admin/AdminLayout';
import AdminRoute from './components/admin/AdminRoute';
import { hasAdminAccess } from './utils/adminAccess';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Feed = lazy(() => import('./pages/Feed'));
const CreateRequest = lazy(() => import('./pages/CreateRequest'));
const RequestDetail = lazy(() => import('./pages/RequestDetail'));
const PublicRequest = lazy(() => import('./pages/PublicRequest'));
const Communities = lazy(() => import('./pages/Communities'));
const CommunityDetail = lazy(() => import('./pages/CommunityDetail'));
const CommunityManage = lazy(() => import('./pages/CommunityManage'));
const Chats = lazy(() => import('./pages/Chats'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const MyRequests = lazy(() => import('./pages/MyRequests'));
const AcceptedRequests = lazy(() => import('./pages/AcceptedRequests'));
const Profile = lazy(() => import('./pages/Profile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const VolunteerSettings = lazy(() => import('./pages/VolunteerSettings'));
const VolunteerDashboard = lazy(() => import('./pages/VolunteerDashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Notifications = lazy(() => import('./pages/Notifications'));
const AiPlayground = lazy(() => import('./pages/AiPlayground'));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminRequestsPage = lazy(() => import('./pages/admin/AdminRequestsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminCommunitiesPage = lazy(() => import('./pages/admin/AdminCommunitiesPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminBroadcastPage = lazy(() => import('./pages/admin/AdminBroadcastPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

let emailLinkVerificationUrl = '';
let emailLinkVerificationPromise = null;

function RouteFallback() {
  return <Spinner label="Loading page" />;
}

function ProtectedRoute({ children, allowOnboarding = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!allowOnboarding && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />;
  }
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading, routeAfterAuth } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) return <Navigate to={routeAfterAuth(user)} replace />;
  return children;
}

function AdminOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasAdminAccess(user)) return <Navigate to="/forbidden" replace />;
  return children;
}

function EmailLinkAuthGate() {
  const { completeLoginLink } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentUrl = window.location.href;
    let active = true;

    if (emailLinkVerificationUrl !== currentUrl || !emailLinkVerificationPromise) {
      emailLinkVerificationUrl = currentUrl;
      emailLinkVerificationPromise = completeLoginLink(currentUrl).finally(() => {
        if (emailLinkVerificationUrl === currentUrl) emailLinkVerificationPromise = null;
      });
    }

    emailLinkVerificationPromise
      .then((userData) => {
        if (active) navigate(userData?.onboardingCompleted ? '/feed' : '/onboarding', { replace: true });
      })
      .catch((error) => {
        if (active) navigate('/login', { replace: true, state: { authError: error.message || 'We could not verify the sign-in link.' } });
      });

    return () => { active = false; };
  }, [completeLoginLink, location.pathname, location.search, navigate]);

  return <Spinner label="Verifying sign-in link" />;
}

function EmailLinkRoute() {
  const { isEmailLinkLogin } = useAuth();
  return isEmailLinkLogin(window.location.href) ? <EmailLinkAuthGate /> : <Outlet />;
}

function Forbidden() {
  return (
    <div className="animate-in p7d-page p7d-narrow">
      <PageHeader
        eyebrow="Restricted"
        title="You do not have access"
        description="This area is available only to members with the required role."
      />
      <Card>
        <ErrorState
          title="Permission denied"
          message="Your account is signed in, but it does not have access to this page."
        />
        <div className="p7d-action-row">
          <Button to="/feed" variant="secondary">Return to feed</Button>
          <Button to="/settings">Open settings</Button>
        </div>
      </Card>
    </div>
  );
}

function NotFound() {
  return (
    <div className="animate-in p7d-page p7d-narrow">
      <PageHeader
        eyebrow="Not found"
        title="Page not found"
        description="The page may have moved, or the link may no longer be active."
      />
      <Card>
        <ErrorState
          title="Nothing here"
          message="Use the navigation to return to a known Sahay page."
        />
        <div className="p7d-action-row">
          <Button to="/feed">Return home</Button>
          <Button to="/communities" variant="secondary">Browse communities</Button>
        </div>
      </Card>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, routeAfterAuth } = useAuth();
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<EmailLinkRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={loading ? <RouteFallback /> : user ? <Navigate to={routeAfterAuth(user)} replace /> : <Landing />} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute allowOnboarding><Onboarding /></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><CreateRequest /></ProtectedRoute>} />
            <Route path="/request/:id" element={<ProtectedRoute><RequestDetail /></ProtectedRoute>} />
            <Route path="/public/request/:id" element={<PublicRequest />} />
            <Route path="/communities" element={<ProtectedRoute><Communities /></ProtectedRoute>} />
            <Route path="/community/:id" element={<ProtectedRoute><CommunityDetail /></ProtectedRoute>} />
            <Route path="/community/:id/manage" element={<ProtectedRoute><CommunityManage /></ProtectedRoute>} />
            <Route path="/chats" element={<ProtectedRoute><Chats /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
            <Route path="/accepted-requests" element={<ProtectedRoute><AcceptedRequests /></ProtectedRoute>} />
            <Route path="/profile/requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/volunteer/settings" element={<ProtectedRoute><VolunteerSettings /></ProtectedRoute>} />
            <Route path="/volunteer/dashboard" element={<ProtectedRoute><VolunteerDashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/ai-playground" element={<AdminOnlyRoute><AiPlayground /></AdminOnlyRoute>} />
            <Route path="/forbidden" element={<Forbidden />} />
            <Route
              path="/admin"
              element={(
                <ProtectedRoute>
                  <AdminRoute>
                    {({ adminRole }) => <AdminLayout adminRole={adminRole} />}
                  </AdminRoute>
                </ProtectedRoute>
              )}
            >
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<AdminOverviewPage />} />
              <Route path="requests" element={<AdminRequestsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="communities" element={<AdminCommunitiesPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="broadcast" element={<AdminBroadcastPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <div className="app-bg-wrapper">
      <div className="app-bg" />
      <div className="app-container">
        <AppRoutes />
      </div>
    </div>
  );
}
