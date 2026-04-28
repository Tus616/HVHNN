import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminLoadingState from '../../components/admin/AdminLoadingState';
import { adminApi } from '../../services/adminApi';

export default function AdminAnalyticsPage() {
  const { user, showToast } = useOutletContext();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      setLoading(true);

      try {
        const response = await adminApi.getAnalytics(user);
        if (!active) return;
        setAnalytics(response.data);

        if (response.fallback) {
          showToast({
            type: 'info',
            title: 'Using fallback analytics',
            message: 'The charts are being filled with safe mock data until the backend analytics endpoint is ready.',
          });
        }
      } catch (error) {
        if (!active) return;
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAnalytics();

    return () => {
      active = false;
    };
  }, [showToast, user]);

  if (loading) {
    return <AdminLoadingState label="Loading analytics..." />;
  }

  if (!analytics) {
    return (
      <AdminEmptyState
        title="Analytics unavailable"
        description="Try reloading the page in a moment."
      />
    );
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">Analytics</p>
          <h2>Response and category insights</h2>
          <p>Understand weekly trends, category mix, and top volunteer performance.</p>
        </div>
      </section>

      <section className="admin-chart-grid">
        <div className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h3>Requests Per Day</h3>
              <p>Last 7 days</p>
            </div>
          </div>

          <div className="admin-chart-shell">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.requestsPerDay}>
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="requests" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h3>Category Breakdown</h3>
              <p>Current visible scope</p>
            </div>
          </div>

          <div className="admin-chart-shell">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={analytics.categoryBreakdown}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={88}
                  innerRadius={48}
                  paddingAngle={4}
                >
                  {analytics.categoryBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="admin-legend">
            {analytics.categoryBreakdown.map((entry) => (
              <div key={entry.name} className="admin-legend-item">
                <span className="admin-legend-dot" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}</span>
                <strong>{entry.value}%</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-chart-grid">
        <div className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h3>Average Response Time</h3>
              <p>Measured across recent fulfilled requests</p>
            </div>
          </div>
          <div className="admin-response-time">{analytics.averageResponseTime}</div>
        </div>

        <div className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h3>Top Volunteers</h3>
              <p>Top 5 by completed helps</p>
            </div>
          </div>

          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Helped Count</th>
                  <th>Badge</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topVolunteers.map((volunteer, index) => (
                  <tr key={volunteer.id}>
                    <td>{index + 1}</td>
                    <td>{volunteer.name}</td>
                    <td>{volunteer.helpedCount}</td>
                    <td>{volunteer.badge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
