import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import useBookmarks from '../hooks/useBookmarks';
import { Settings, LogOut, Home, PlusCircle, Users, MessageSquare, Trophy, Shield, Star, Menu, Brain } from 'lucide-react';

const SIDEBAR_NAV = [
  { path: '/feed', icon: <Home size={20} />, label: 'Help Feed' },
  { path: '/create', icon: <PlusCircle size={20} />, label: 'Raise Request' },
  { path: '/communities', icon: <Users size={20} />, label: 'Communities' },
  { path: '/chats', icon: <MessageSquare size={20} />, label: 'Messages' },
  { path: '/leaderboard', icon: <Trophy size={20} />, label: 'Leaderboard' },
  { path: '/ai-playground', icon: <Brain size={20} />, label: 'AI Engine' },
];

export default function AppSidebar({ isCollapsed, onToggle }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { bookmarks } = useBookmarks();
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  
  if (!user) return null;

  const badge = user.verificationLevel || (user.verified ? 'VERIFIED' : 'BASIC');
  const badgeColor = badge === 'TRUSTED' ? 'text-green-500' : badge === 'VERIFIED' ? 'text-blue-500' : 'text-gray-400';

  return (
    <aside className={`discord-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Top Bar Section for Toggle */}
      <div className="sidebar-top-section">
        <button 
          className="sidebar-toggle-btn"
          onClick={onToggle}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <div className="sidebar-toggle-icon-wrapper">
            <Menu size={20} />
          </div>
        </button>
      </div>

      {/* Profile Section */}
      <div className="sidebar-header">
        <Link to="/profile" className="sidebar-profile-link group">
          <div className="sidebar-avatar-container">
            <div className="sidebar-avatar-ring" />
            <div className="sidebar-avatar">
              {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className={`sidebar-status-pill ${user.volunteerStatus === 'ONLINE' ? 'online' : 'offline'}`} />
            )}
          </div>
          {!isCollapsed && (
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">{user.fullName}</div>
              <div className={`sidebar-user-badge ${badgeColor}`}>
                <Shield size={12} fill="currentColor" fillOpacity={0.2} />
                <span>{badge}</span>
              </div>
            </div>
          )}
        </Link>
        {!isCollapsed && <div className="sidebar-divider" />}
      </div>

      {/* Middle Section: Navigation */}
      <nav className="sidebar-main-nav">
        {!isCollapsed && <div className="sidebar-section-label">Main Menu</div>}
        {SIDEBAR_NAV.filter(item => {
          if (item.path === '/ai-playground') return user.role === 'ADMIN';
          return true;
        }).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
            title={isCollapsed ? item.label : ""}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
            {item.path === '/chats' && unreadCount > 0 && (
              <span className={isCollapsed ? "sidebar-notif-dot-collapsed" : "sidebar-notif-dot"}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        ))}
        
        {!isCollapsed && <div className="sidebar-section-label mt-6">Personal</div>}
        <div className="sidebar-nav-item opacity-60 pointer-events-none" title={isCollapsed ? "Rewards (Soon)" : ""}>
          <span className="sidebar-nav-icon"><Star size={20} /></span>
          {!isCollapsed && (
            <>
              <span className="sidebar-nav-label">Rewards</span>
              <span className="text-[10px] ml-auto bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">Soon</span>
            </>
          )}
        </div>
      </nav>

      {/* Bottom Section: Settings & Logout */}
      <div className="sidebar-footer">
        {!isCollapsed && <div className="sidebar-divider" />}
        <Link to="/settings" className={`sidebar-nav-item ${isActive('/settings') ? 'active' : ''}`} title={isCollapsed ? "Settings" : ""}>
          <span className="sidebar-nav-icon"><Settings size={20} /></span>
          {!isCollapsed && <span className="sidebar-nav-label">Settings</span>}
        </Link>
        <button onClick={logout} className="sidebar-nav-item sidebar-logout-btn" title={isCollapsed ? "Logout" : ""}>
          <span className="sidebar-nav-icon"><LogOut size={20} /></span>
          {!isCollapsed && <span className="sidebar-nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
