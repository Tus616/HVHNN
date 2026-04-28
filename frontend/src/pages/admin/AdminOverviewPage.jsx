import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import AdminLoadingState from '../../components/admin/AdminLoadingState';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import StatsCard from '../../components/admin/StatsCard';
import { adminApi } from '../../services/adminApi';

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

export default function AdminOverviewPage() {
  const { user, showToast } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setLoading(true);

      try {
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
            title: 'Using safe fallback data',
            message: 'Some admin endpoints are not ready yet, so the dashboard is showing resilient mock data.',
          });
        }
      } catch (error) {
        if (!active) return;
        console.error(error);
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
        <StatsCard title="Requests Today" value={stats?.totalRequestsToday ?? 0} tone="blue" trendValue="↑ 12%" trendDirection="up" />
        <StatsCard title="Active Volunteers" value={stats?.activeVolunteers ?? 0} tone="green" trendValue="↑ 5%" trendDirection="up" />
        <StatsCard title="Pending Requests" value={stats?.pendingRequests ?? 0} tone="yellow" trendValue="↓ 2%" trendDirection="down" />
        <StatsCard title="Resolved Requests" value={stats?.resolvedRequests ?? 0} tone="green" trendValue="↑ 8%" trendDirection="up" />
        <StatsCard title="Total Members" value={stats?.totalMembers ?? 0} tone="blue" trendValue="↑ 1%" trendDirection="up" />
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
                    <td>{request.category}</td>
                    <td>
                      <AdminStatusBadge
                        value={request.urgency}
                        prefix={request.urgency === 'HIGH' ? '🔴 ' : request.urgency === 'MEDIUM' ? '🟡 ' : '🟢 '}
                      />
                    </td>
                    <td><AdminStatusBadge value={request.status} /></td>
                    <td>{request.raisedBy}</td>
                    <td>{formatTime(request.createdAt)}</td>
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
