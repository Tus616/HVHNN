import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import AdminLoadingState from '../../components/admin/AdminLoadingState';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import StatsCard from '../../components/admin/StatsCard';
import { adminApi } from '../../services/adminApi';
import { ErrorState } from '../../components/ui';
import { formatDateTime } from '../../utils/displayFormat';
import { normalizeApiError } from '../../utils/errors';

export default function AdminOverviewPage() {
  const { user, showToast } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setLoading(true);

      try {
        setError('');
        const [statsResponse, recentResponse] = await Promise.all([
          adminApi.getOverview(user),
          adminApi.getRecentRequests(user),
        ]);

        if (!active) return;

        setStats(statsResponse.data);
        setRecentRequests(recentResponse.data);

        if (statsResponse.fallback || recentResponse.fallback) {
          showToast({
            type: 'info',
            title: 'Using derived dashboard data',
            message: 'Showing the admin data currently available. Some live totals are unavailable right now.',
          });
        }
      } catch (error) {
        if (!active) return;
        setError(normalizeApiError(error, 'Could not load admin overview.').message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOverview();

    return () => {
      active = false;
    };
  }, [showToast, user]);

  if (loading) {
    return <AdminLoadingState label="Loading overview..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">Overview</p>
          <h2>Admin snapshot</h2>
          <p>Track daily request flow, volunteer activity, and the latest escalations.</p>
        </div>
        <div className="admin-actions-row">
          <Link to="/admin/requests" className="admin-btn admin-btn-primary">View All Requests</Link>
          <Link to="/admin/users" className="admin-btn admin-btn-secondary">View All Users</Link>
        </div>
      </section>

      <section className="admin-stats-grid">
        <StatsCard title="Requests Today" value={stats?.totalRequestsToday ?? 0} tone="blue" />
        <StatsCard title="Active Volunteers" value={stats?.activeVolunteers ?? 0} tone="green" />
        <StatsCard title="Pending Requests" value={stats?.pendingRequests ?? 0} tone="yellow" />
        <StatsCard title="Resolved Requests" value={stats?.resolvedRequests ?? 0} tone="green" />
        <StatsCard title="Total Members" value={stats?.totalMembers ?? 0} tone="blue" />
      </section>


      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h3>Recent Requests</h3>
            <p>Last five requests raised across the visible admin scope.</p>
          </div>
        </div>

        {recentRequests.length === 0 ? (
          <AdminEmptyState
            title="No recent requests"
            description="Requests will appear here once members raise help needs."
          />
        ) : (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Raised By</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.id}</td>
                    <td><AdminStatusBadge value={request.category} /></td>
                    <td>
                      <AdminStatusBadge
                        value={request.urgency}
                        prefix={request.urgency === 'HIGH' ? '🔴 ' : request.urgency === 'MEDIUM' ? '🟡 ' : '🟢 '}
                      />
                    </td>
                    <td><AdminStatusBadge value={request.status} /></td>
                    <td>{request.raisedBy}</td>
                    <td>{formatDateTime(request.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
