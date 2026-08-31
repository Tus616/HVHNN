import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getScopedCommunityId, isSuperAdmin } from '../../utils/adminAccess';
import AdminSidebar from './AdminSidebar';
import AdminToast from './AdminToast';

export default function AdminLayout({ adminRole }) {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const outletContext = useMemo(() => ({
    user,
    adminRole,
    scopedCommunityId: getScopedCommunityId(user, 'community-iit-delhi'),
    isSuperAdmin: isSuperAdmin(user),
    showToast(nextToast) {
      setToast(nextToast);
    },
  }), [adminRole, user]);

  return (
    <div className="admin-shell">
      <AdminSidebar role={adminRole} />

      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p className="admin-topbar-eyebrow">Help Where It Matters</p>
            <h1>Operations Console</h1>
          </div>

          <div className="admin-topbar-user">
            <div>
              <strong>{user?.fullName || 'Admin User'}</strong>
              <span>{adminRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Community Admin'}</span>
            </div>
          </div>
        </header>

        <Outlet context={outletContext} />
      </section>

      <AdminToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
