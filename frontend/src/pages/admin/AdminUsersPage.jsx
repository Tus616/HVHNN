import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminLoadingState from '../../components/admin/AdminLoadingState';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import { adminApi } from '../../services/adminApi';
import { ConfirmationDialog, DropdownMenu, ErrorState } from '../../components/ui';
import { formatDateShort } from '../../utils/displayFormat';
import { normalizeApiError } from '../../utils/errors';

const DEFAULT_FILTERS = {
  role: '',
  status: '',
  page: 0,
  size: 10,
};

export default function AdminUsersPage() {
  const { user, showToast } = useOutletContext();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [userPage, setUserPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      setLoading(true);

      try {
        setError('');
        const response = await adminApi.getUsers(filters, user);
        if (!active) return;
        setUserPage(response.data);
      } catch (error) {
        if (!active) return;
        setError(normalizeApiError(error, 'Could not load admin users.').message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, [filters, user]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === 'page' ? value : 0,
    }));
  }

  async function handleUserAction(action, row) {
    try {
      if (action === 'verify') {
        await adminApi.verifyUser(row.id);
        setUserPage((current) => ({
          ...current,
          items: (Array.isArray(current?.items) ? current.items : []).map((entry) => (
            entry.id === row.id ? { ...entry, verified: true, status: entry.blocked ? 'BLOCKED' : 'VERIFIED' } : entry
          )),
        }));
        showToast({ type: 'success', title: 'User verified', message: `${row.fullName} is now verified.` });
      }

      if (action === 'block') {
        await adminApi.toggleBlockUser(row.id, row.blocked);
        setUserPage((current) => ({
          ...current,
          items: (Array.isArray(current?.items) ? current.items : []).map((entry) => (
            entry.id === row.id
              ? { ...entry, blocked: !entry.blocked, status: !entry.blocked ? 'BLOCKED' : entry.verified ? 'VERIFIED' : 'UNVERIFIED' }
              : entry
          )),
        }));
        showToast({
          type: row.blocked ? 'success' : 'warning',
          title: row.blocked ? 'User unblocked' : 'User blocked',
          message: `${row.fullName} was ${row.blocked ? 'restored' : 'blocked'}.`,
        });
      }

      if (action === 'badge') {
        await adminApi.assignVolunteerBadge(row.id);
        setUserPage((current) => ({
          ...current,
          items: (Array.isArray(current?.items) ? current.items : []).map((entry) => (
            entry.id === row.id ? { ...entry, role: 'VOLUNTEER', badge: 'Volunteer' } : entry
          )),
        }));
        showToast({ type: 'success', title: 'Volunteer badge assigned', message: `${row.fullName} now has volunteer access.` });
      }
    } catch (error) {
      showToast({ type: 'danger', title: 'Action failed', message: normalizeApiError(error, 'Please try again.').message });
    } finally {
      setConfirmation(null);
    }
  }

  if (loading && !userPage) {
    return <AdminLoadingState label="Loading user management..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  const rows = userPage?.items || [];

  return (
    <div className="admin-page-stack">
      <section className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">User Management</p>
          <h2>Manage members, volunteers, and admins</h2>
          <p>{userPage?.totalItems || 0} users in the current admin scope</p>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-filter-grid">
          <select className="admin-input" value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="VOLUNTEER">Volunteer</option>
            <option value="ADMIN">Admin</option>
          </select>

          <select className="admin-input" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All Status</option>
            <option value="VERIFIED">Verified</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <AdminEmptyState
            title="No users match these filters"
            description="Try a different role or status filter."
          />
        ) : (
          <>
            <div className="admin-table-shell">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Community</th>
                    <th>Verified</th>
                    <th>Joined Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-user-avatar">
                            {member.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{member.fullName}</strong>
                            <span>{member.badge}</span>
                          </div>
                        </div>
                      </td>
                      <td>{member.email}</td>
                      <td><AdminStatusBadge value={member.role} /></td>
                      <td>{member.community}</td>
                      <td><AdminStatusBadge value={member.status} /></td>
                      <td>{formatDateShort(member.joinedDate)}</td>
                      <td>
                        <DropdownMenu label="Actions">
                          <button type="button" disabled={member.verified} onClick={() => handleUserAction('verify', member)}>Verify</button>
                          <button type="button" onClick={() => setConfirmation({ action: 'block', row: member })}>{member.blocked ? 'Unblock' : 'Block'}</button>
                          <button type="button" onClick={() => handleUserAction('badge', member)}>Assign volunteer badge</button>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminPagination
              page={userPage.page}
              totalPages={userPage.totalPages}
              onPageChange={(pageNumber) => updateFilter('page', pageNumber)}
            />
          </>
        )}
      </section>
      <ConfirmationDialog
        open={Boolean(confirmation)}
        title={confirmation?.row?.blocked ? 'Unblock user?' : 'Block user?'}
        message={`${confirmation?.row?.fullName || 'This user'} will be ${confirmation?.row?.blocked ? 'restored' : 'blocked'} in the admin scope.`}
        confirmLabel={confirmation?.row?.blocked ? 'Unblock' : 'Block'}
        destructive={!confirmation?.row?.blocked}
        onClose={() => setConfirmation(null)}
        onConfirm={() => handleUserAction(confirmation.action, confirmation.row)}
      />
    </div>
  );
}
