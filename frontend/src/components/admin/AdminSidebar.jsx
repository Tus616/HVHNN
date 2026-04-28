import {
  BarChart3,
  BellRing,
  Building2,
  ClipboardList,
  Home,
  Settings,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/admin/overview', label: 'Overview', icon: Home, roles: ['SUPER_ADMIN', 'COMMUNITY_ADMIN'] },
  { to: '/admin/requests', label: 'Requests', icon: ClipboardList, roles: ['SUPER_ADMIN', 'COMMUNITY_ADMIN'] },
  { to: '/admin/users', label: 'Users', icon: Users, roles: ['SUPER_ADMIN', 'COMMUNITY_ADMIN'] },
  { to: '/admin/communities', label: 'Communities', icon: Building2, roles: ['SUPER_ADMIN'] },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, roles: ['SUPER_ADMIN', 'COMMUNITY_ADMIN'] },
  { to: '/admin/broadcast', label: 'Broadcast', icon: BellRing, roles: ['SUPER_ADMIN', 'COMMUNITY_ADMIN'] },
  { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['SUPER_ADMIN', 'COMMUNITY_ADMIN'] },
];

export default function AdminSidebar({ role }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-badge">HVHN</div>
        <div>
          <strong>Admin Dashboard</strong>
          <span>{role === 'SUPER_ADMIN' ? 'Platform scope' : 'Community scope'}</span>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        {NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
