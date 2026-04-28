import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext';
import { timeAgo } from './utils/timeUtils';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import CreateRequest from './pages/CreateRequest';
import RequestDetail from './pages/RequestDetail';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Chats from './pages/Chats';
import EditProfile from './pages/EditProfile';
import Communities from './pages/Communities';
import CommunityDetail from './pages/CommunityDetail';
import CommunityManage from './pages/CommunityManage';
import VolunteerDashboard from './pages/VolunteerDashboard';
import VolunteerSettings from './pages/VolunteerSettings';
import Settings from './pages/Settings';
import PublicRequest from './pages/PublicRequest';
import AiPlayground from './pages/AiPlayground';

import AdminLayout from './components/admin/AdminLayout';
import AdminRoute from './components/admin/AdminRoute';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminRequestsPage from './pages/admin/AdminRequestsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminCommunitiesPage from './pages/admin/AdminCommunitiesPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminBroadcastPage from './pages/admin/AdminBroadcastPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import { hasAdminAccess } from './utils/adminAccess';


import Footer from './components/Footer';
import AppSidebar from './components/AppSidebar';
import CommunitiesSidebar from './components/CommunitiesSidebar';
import ToastContainer from './components/ToastContainer';


let emailLinkVerificationUrl = '';
let emailLinkVerificationPromise = null;

const NOTIF_ICONS = { request: '🆘', volunteer: '🤝', success: '✅', community: '🏘️', reward: '⭐', system: '🔔' };

function NotificationPanel() {
  const { notifications, showPanel, closePanel, markAsRead, markAllAsRead, clearAll, unreadCount } = useNotifications();

  if (!showPanel) return null;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={closePanel} />
      <div className="notif-panel">
        <div className="notif-header">
          <h3>🔔 Notifications</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {unreadCount > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={markAllAsRead} style={{ fontSize: '0.75rem' }}>
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={clearAll} style={{ fontSize: '0.75rem' }}>
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="notif-list" style={{ maxHeight: '450px', overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>🔕</div>
              <p>No new notifications right now</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Link
                key={notification.id}
                to={notification.link || '#'}
                onClick={() => {
                  markAsRead(notification.id);
                  closePanel();
                }}
                className={`notif-item ${notification.read ? '' : 'unread'}`}
              >
                <div className="notif-icon" style={{ 
                  background: notification.read ? 'var(--bg-secondary)' : 'rgba(99,102,241,0.1)',
                  color: notification.read ? 'var(--text-muted)' : 'var(--accent-primary)'
                }}>
                  {NOTIF_ICONS[notification.type] || '🔔'}
                </div>
                <div className="notif-content">
                  <div className="notif-title" style={{ fontWeight: notification.read ? 500 : 700 }}>{notification.title}</div>
                  <div className="notif-msg" style={{ fontSize: '0.85rem' }}>{notification.message}</div>
                  <div className="notif-time" style={{ fontSize: '0.75rem', marginTop: '4px' }}>{timeAgo(notification.time)}</div>
                </div>
                {!notification.read && <div className="notif-dot" />}
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Navbar({ sidebarType, isSidebarOpen, toggleSidebar }) {
  const { user, logout } = useAuth();
  const { unreadCount, togglePanel } = useNotifications();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isActive = (path) => location.pathname === path ? 'active' : '';
  const volunteerPath = user?.isVolunteer ? '/volunteer/dashboard' : '/volunteer/settings';
  const volunteerActive = location.pathname.startsWith('/volunteer') ? 'active' : '';

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!user) {
    return (
      <nav className="navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100 }}>
        <Link to="/" className="navbar-brand">
          <span className="logo-icon">⚡</span>
          HVHN
        </Link>
        <div className="navbar-links">
          <Link to="/login">Login</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
        </div>
      </nav>
    );
  }


  return (
    <>
      <nav className={`navbar minimal-top-bar ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
        <div className="navbar-context-wrapper">
          <div className="navbar-context-title">
            {location.pathname.split('/').pop().replace(/-/g, ' ') || 'Dashboard'}
          </div>
        </div>

        <div className="navbar-user">
          <button
            className="btn btn-icon btn-secondary theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button className="notif-bell" onClick={togglePanel} title="Notifications">
            🔔
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
        </div>
        <NotificationPanel />
      </nav>


      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-nav-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-nav-drawer">
            <div className="mobile-nav-profile">
              <div className="mobile-nav-avatar">
                {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="mobile-nav-name">{user.fullName}</div>
                <div className="mobile-nav-email">{user.email}</div>
              </div>
            </div>
            <div className="mobile-nav-links">
              <Link to="/feed" className={`mobile-nav-link ${isActive('/feed')}`}>
                <span>🆘</span> Help Feed
              </Link>
              <Link to="/create" className={`mobile-nav-link ${isActive('/create')}`}>
                <span>➕</span> Raise Request
              </Link>
              <Link to="/communities" className={`mobile-nav-link ${isActive('/communities')}`}>
                <span>🏘️</span> Communities
              </Link>
              <Link to={volunteerPath} className={`mobile-nav-link ${volunteerActive}`}>
                <span>🤝</span> Volunteer
              </Link>
              <Link to="/leaderboard" className={`mobile-nav-link ${isActive('/leaderboard')}`}>
                <span>🏆</span> Leaderboard
              </Link>
              <Link to="/profile" className={`mobile-nav-link ${isActive('/profile')}`}>
                <span>👤</span> My Profile
              </Link>
              {hasAdminAccess(user) && (
                <Link to="/admin/overview" className={`mobile-nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
                  <span>⚙️</span> Admin Panel
                </Link>
              )}
            </div>
            <div className="mobile-nav-footer">
              <button className="btn btn-danger btn-sm" onClick={logout} style={{ width: '100%', justifyContent: 'center' }}>
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
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
        if (emailLinkVerificationUrl === currentUrl) {
          emailLinkVerificationPromise = null;
        }
      });
    }

    const verifyLink = async () => {
      try {
        await emailLinkVerificationPromise;
        if (active) {
          navigate('/feed', { replace: true });
        }
      } catch (error) {
        if (active) {
          navigate('/login', {
            replace: true,
            state: {
              authError: error.message || 'We could not verify your authentication link.',
            },
          });
        }
      }
    };

    verifyLink();

    return () => {
      active = false;
    };
  }, [completeLoginLink, location.pathname, location.search, navigate]);

  return null;
}

// Sidebar visibility logic
function getSidebarType(pathname) {
  if (pathname.startsWith('/admin')) return 'NONE';
  if (['/feed', '/create'].some(p => pathname.startsWith(p))) return 'STATIC';
  if (pathname === '/communities' || pathname === '/communities/') return 'COMMUNITY';
  const COLLAPSIBLE = ['/chats', '/leaderboard', '/volunteer', '/profile', '/request', '/community', '/ai-playground'];
  if (COLLAPSIBLE.some(p => pathname.startsWith(p))) return 'COLLAPSIBLE';
  return 'NONE';
}

function AppRoutes() {
  const { user, isEmailLinkLogin } = useAuth();
  const location = useLocation();
  const emailLinkInProgress = isEmailLinkLogin(window.location.href);
  const sidebarType = user ? getSidebarType(location.pathname) : 'NONE';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Only auto-close on mobile when changing pages
    if (window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname]);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  if (emailLinkInProgress) {
    return (
      <>
        <Navbar />
        <div className="main-content">
          <EmailLinkAuthGate />
          <div className="auth-page animate-in">
            <div className="auth-card" style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 20px' }} />
              <h2>Verifying Link</h2>
              <p className="auth-subtitle">
                Completing your email-link sign-in and restoring your HVHN session.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const showSidebarComponent = sidebarType !== 'NONE';
  const isSidebarLayout = sidebarType === 'STATIC' || sidebarType === 'COMMUNITY' || (sidebarType === 'COLLAPSIBLE' && !isSidebarCollapsed);

  // Minimal layout for public pages
  if (location.pathname.startsWith('/public/request/')) {
    return (
      <div className="main-content">
        <Routes>
          <Route path="/public/request/:id" element={<PublicRequest />} />
        </Routes>
      </div>
    );
  }

  return (
    <>
      {user && <AppSidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />}
      <ToastContainer />
      <Navbar sidebarType={sidebarType} toggleSidebar={toggleSidebar} isSidebarOpen={!isSidebarCollapsed} />
      <div className={`main-layout ${user ? 'with-sidebar' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="main-content">

          <Routes>
            <Route path="/" element={user ? <Navigate to="/feed" /> : <Landing />} />
            <Route path="/login" element={user ? <Navigate to="/feed" /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/feed" /> : <Register />} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><CreateRequest /></ProtectedRoute>} />
            <Route path="/request/:id" element={<ProtectedRoute><RequestDetail /></ProtectedRoute>} />
            <Route path="/public/request/:id" element={<PublicRequest />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/chats" element={<ProtectedRoute><Chats /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/communities" element={<ProtectedRoute><Communities /></ProtectedRoute>} />
            <Route path="/community/:id" element={<ProtectedRoute><CommunityDetail /></ProtectedRoute>} />
            <Route path="/community/:id/manage" element={<ProtectedRoute><CommunityManage /></ProtectedRoute>} />
            <Route path="/volunteer/settings" element={<ProtectedRoute><VolunteerSettings /></ProtectedRoute>} />
            <Route path="/volunteer/dashboard" element={<ProtectedRoute><VolunteerDashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/ai-playground" element={<ProtectedRoute><AdminRoute><AiPlayground /></AdminRoute></ProtectedRoute>} />

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
          </Routes>
        </div>
      </div>
      <Footer />
    </>
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
