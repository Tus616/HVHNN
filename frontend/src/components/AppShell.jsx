import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ClipboardList,
  HeartHandshake,
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PlusCircle,
  Settings,
  Shield,
  Sun,
  Trophy,
  User,
  Users,
  X,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar, IconButton } from './ui';
import BrandLogo from './BrandLogo';
import SupportAssistant from './SupportAssistant';
import ToastContainer from './ToastContainer';
import { safeInternalPath } from '../utils/errors';
import { timeAgo } from '../utils/timeUtils';
import apiService from '../services/api';

const NAV = [
  { to: '/feed', label: 'Help Feed', icon: Home },
  { to: '/create', label: 'Raise Request', icon: PlusCircle },
  { to: '/my-requests', label: 'My Requests', icon: ClipboardList },
  { to: '/accepted-requests', label: 'Accepted Requests', icon: CheckCheck },
  { to: '/communities', label: 'Communities', icon: Users },
  { to: '/chats', label: 'Messages', icon: MessageSquare, chatBadge: true },
  { to: '/notifications', label: 'Notifications', icon: Bell, notificationBadge: true },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/volunteer/settings', label: 'Volunteer Settings', icon: HeartHandshake },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

function useIsDrawerNavigation() {
  const [isDrawer, setIsDrawer] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 1023px)').matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsDrawer(query.matches);
    update();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  return isDrawer;
}

function NotificationPreview({ bellRef }) {
  const { notifications, showPanel, closePanel, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  useEffect(() => {
    if (!showPanel) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closePanel();
        bellRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [bellRef, closePanel, showPanel]);

  if (!showPanel) return null;
  return (
    <>
      <div className="mobile-nav-overlay" onClick={closePanel} />
      <aside className="p7c-notif-popover" aria-label="Notification preview">
        <div className="p7c-notif-popover__header">
          <div>
            <h3>Notifications</h3>
            <p>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={() => markAllAsRead()}>
              <CheckCheck size={15} /> Mark all read
            </button>
          )}
        </div>
        <div className="p7c-notif-preview-list">
          {notifications.length === 0 ? (
            <div className="p7c-notif-preview-empty">No notifications right now.</div>
          ) : notifications.slice(0, 8).map((notification) => (
            <Link
              key={notification.id}
              to={safeInternalPath(notification.link, '/notifications')}
              className={`p7c-notif-preview-item ${notification.read ? '' : 'is-unread'}`}
              onClick={() => {
                markAsRead(notification.id).catch(() => {});
                closePanel();
              }}
            >
              <span className="p7c-notif-dot" aria-label={notification.read ? 'Read' : 'Unread'} />
              <Bell size={17} aria-hidden="true" />
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <time>{timeAgo(notification.time)}</time>
              </div>
            </Link>
          ))}
          <Link className="p7c-notif-view-all" to="/notifications" onClick={closePanel}>
            View all notifications
          </Link>
        </div>
      </aside>
    </>
  );
}

function NavLinkItem({ item, onNavigate, chatUnreadCount = 0 }) {
  const location = useLocation();
  const { unreadCount = 0 } = useNotifications();
  const Icon = item.icon;
  const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  return (
    <Link to={item.to} aria-current={active ? 'page' : undefined} onClick={onNavigate} title={item.label} data-label={item.label}>
      <Icon size={19} aria-hidden="true" />
      <span>{item.label}</span>
      {item.chatBadge && chatUnreadCount > 0 && <span className="phase7-badge-count phase7-badge-count--chat">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</span>}
      {item.notificationBadge && unreadCount > 0 && <span className="phase7-badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </Link>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { unreadCount = 0, togglePanel } = useNotifications();
  const { isDark, toggleTheme } = useTheme();
  const isDrawerNavigation = useIsDrawerNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const bellRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDrawerNavigation) setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    if (isDrawerNavigation && sidebarOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerNavigation, sidebarOpen]);

  useEffect(() => {
    if (!isDrawerNavigation || !sidebarOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawerNavigation, sidebarOpen]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setChatUnreadCount(0);
      return;
    }
    if (typeof apiService.getChatRooms !== 'function') {
      setChatUnreadCount(0);
      return;
    }
    apiService.getChatRooms()
      .then((response) => {
        const count = (response.data || []).reduce((sum, room) => sum + Number(room.unreadCount || 0), 0);
        setChatUnreadCount(count);
      })
      .catch(() => setChatUnreadCount(0));
  }, [user, location.pathname]);

  const pageTitle = useMemo(() => {
    const current = NAV.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
    if (current) return current.label;
    if (location.pathname.startsWith('/admin')) return 'Admin';
    if (location.pathname.startsWith('/profile')) return 'Profile';
    return 'Sahay';
  }, [location.pathname]);

  const breadcrumb = useMemo(() => {
    if (location.pathname.startsWith('/request/')) return ['Help Feed', 'Request Detail'];
    if (location.pathname === '/create') return ['Help Feed', 'Raise Request'];
    return [];
  }, [location.pathname]);

  if (!user) {
    return (
      <div className="phase7-shell phase7-public-shell">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <ToastContainer />
        <Outlet />
      </div>
    );
  }

  const toggleNavigation = () => {
    if (isDrawerNavigation) {
      setSidebarOpen((open) => !open);
      return;
    }
    setSidebarCollapsed((collapsed) => !collapsed);
  };

  const closeDrawerAfterNavigate = () => {
    if (isDrawerNavigation) setSidebarOpen(false);
  };

  const sidebar = (
    <aside className={`phase7-sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
      <div className="phase7-sidebar__brand">
        <Link to="/feed" className="phase7-brand" onClick={closeDrawerAfterNavigate} title="Sahay">
          <BrandLogo variant={sidebarCollapsed && !isDrawerNavigation ? 'mark' : 'compact'} />
        </Link>
        <IconButton
          label={isDrawerNavigation ? 'Close navigation' : 'Toggle navigation'}
          className="phase7-sidebar-toggle"
          onClick={toggleNavigation}
          aria-expanded={isDrawerNavigation ? sidebarOpen : !sidebarCollapsed}
        >
          {isDrawerNavigation ? <X size={18} /> : <Menu size={18} />}
        </IconButton>
      </div>
      <Link className="phase7-sidebar__profile" to="/profile" onClick={closeDrawerAfterNavigate} title={user.fullName || 'Sahay member'}>
        <Avatar name={user.fullName || user.email || 'Sahay member'} src={user.profileImage || user.avatarUrl} />
        <span>
          <strong>{user.fullName || 'Sahay member'}</strong>
          <small>{user.verified ? 'Verified member' : 'Basic member'}</small>
        </span>
      </Link>
      <nav className="phase7-nav">
        {NAV.map((item) => <NavLinkItem key={`${item.to}-${item.label}`} item={item} chatUnreadCount={chatUnreadCount} onNavigate={closeDrawerAfterNavigate} />)}
        {user.role === 'ADMIN' && (
          <Link to="/admin/overview" aria-current={location.pathname.startsWith('/admin') ? 'page' : undefined} onClick={closeDrawerAfterNavigate} title="Admin" data-label="Admin">
            <Shield size={19} aria-hidden="true" />
            <span>Admin</span>
          </Link>
        )}
      </nav>
      <div className="phase7-sidebar__footer">
        <button type="button" className="phase7-help-button" onClick={() => setAssistantOpen(true)} title="Need Help" data-label="Need Help">
          <LifeBuoy size={19} aria-hidden="true" />
          <span>Need Help</span>
        </button>
        <Link to="/settings" aria-current={location.pathname.startsWith('/settings') ? 'page' : undefined} onClick={closeDrawerAfterNavigate} title="Settings" data-label="Settings">
          <Settings size={19} aria-hidden="true" />
          <span>Settings</span>
        </Link>
        <button type="button" onClick={() => { closeDrawerAfterNavigate(); logout(); }} title="Logout" data-label="Logout">
          <LogOut size={19} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`phase7-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'} ${sidebarOpen ? 'is-drawer-open' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ToastContainer />
      {isDrawerNavigation && sidebarOpen && <div className="phase7-mobile-overlay" onClick={() => setSidebarOpen(false)} />}
      {sidebar}
      <SupportAssistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <section className="phase7-main-column">
        <header className="phase7-topbar">
          <div className="phase7-topbar__title">
            <IconButton
              label="Toggle navigation"
              className="phase7-header-toggle"
              onClick={toggleNavigation}
              aria-expanded={isDrawerNavigation ? sidebarOpen : !sidebarCollapsed}
            >
              <Menu size={19} />
            </IconButton>
            <IconButton
              label="Go back"
              onClick={() => navigate(-1)}
              style={{ padding: '6px', marginRight: '4px' }}
            >
              <ArrowLeft size={18} />
            </IconButton>
            <span>
              {breadcrumb.length > 0 && <small>{breadcrumb.join(' / ')}</small>}
              <strong>{pageTitle}</strong>
            </span>
          </div>
          <div className="phase7-topbar__actions">
            <span className={`phase7-connection ${online ? 'is-online' : 'is-offline'}`} role="status">
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              {online ? 'Online' : 'Offline'}
            </span>
            <IconButton label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
              {isDark ? <Sun size={19} /> : <Moon size={19} />}
            </IconButton>
            <IconButton ref={bellRef} label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'} onClick={togglePanel}>
              <Bell size={19} />
              {unreadCount > 0 && <span className="phase7-badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </IconButton>
            <Link className="phase7-topbar__avatar" to="/profile" aria-label="Open profile">
              <Avatar name={user.fullName || user.email || 'Sahay member'} src={user.profileImage || user.avatarUrl} />
            </Link>
          </div>
          <NotificationPreview bellRef={bellRef} />
        </header>
        {!online && <div className="phase7-offline" role="status">You are offline. Some actions may not work.</div>}
        <div className="phase7-main">
          <main id="main-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </section>
    </div>
  );
}
