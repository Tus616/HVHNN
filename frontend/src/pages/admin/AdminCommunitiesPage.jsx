import { useEffect, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminLoadingState from '../../components/admin/AdminLoadingState';
import AdminModal from '../../components/admin/AdminModal';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import { adminApi } from '../../services/adminApi';

export default function AdminCommunitiesPage() {
  const { user, showToast, isSuperAdmin } = useOutletContext();
  const [communities, setCommunities] = useState([]);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadCommunities() {
      setLoading(true);

      try {
        const response = await adminApi.getCommunities(user);
        if (!active) return;
        setCommunities(response.data);
      } catch (error) {
        if (!active) return;
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCommunities();

    return () => {
      active = false;
    };
  }, [user]);

  if (!isSuperAdmin) {
    return <Navigate to="/admin/overview" replace />;
  }

  if (loading) {
    return <AdminLoadingState label="Loading community management..." />;
  }

  async function handleCommunityAction(action, community) {
    try {
      if (action === 'approve') {
        await adminApi.approveCommunity(community.id);
        setCommunities((current) => current.map((entry) => (
          entry.id === community.id ? { ...entry, status: 'ACTIVE' } : entry
        )));
        showToast({ type: 'success', title: 'Community approved', message: `${community.name} is now active.` });
      } else {
        await adminApi.deactivateCommunity(community.id);
        setCommunities((current) => current.map((entry) => (
          entry.id === community.id ? { ...entry, status: 'DEACTIVATED' } : entry
        )));
        showToast({ type: 'warning', title: 'Community deactivated', message: `${community.name} has been deactivated.` });
      }
    } catch (error) {
      console.error(error);
      showToast({ type: 'danger', title: 'Action failed', message: 'Please try again.' });
    }
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">Community Management</p>
          <h2>Review community spaces</h2>
          <p>Approve, inspect, and deactivate community hubs across the network.</p>
        </div>
      </section>

      {communities.length === 0 ? (
        <AdminEmptyState
          title="No communities available"
          description="Approved and pending communities will appear here."
        />
      ) : (
        <section className="admin-community-grid">
          {communities.map((community) => (
            <article key={community.id} className="admin-community-card">
              <div className="admin-community-card-header">
                <div>
                  <h3>{community.name}</h3>
                  <p>{community.type}</p>
                </div>
                <AdminStatusBadge value={community.status} />
              </div>

              <p className="admin-community-copy">{community.description}</p>

              <div className="admin-community-metrics">
                <div>
                  <span>Members</span>
                  <strong>{community.memberCount}</strong>
                </div>
                <div>
                  <span>Requests</span>
                  <strong>{community.requestCount}</strong>
                </div>
              </div>

              <p className="admin-community-address">{community.address}</p>

              <div className="admin-row-actions">
                {community.status === 'PENDING' && (
                  <button type="button" className="admin-btn admin-btn-success" onClick={() => handleCommunityAction('approve', community)}>
                    Approve
                  </button>
                )}
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSelectedCommunity(community)}>
                  View Detail
                </button>
                <button type="button" className="admin-btn admin-btn-danger" onClick={() => handleCommunityAction('deactivate', community)}>
                  Deactivate
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <AdminModal
        open={Boolean(selectedCommunity)}
        title={selectedCommunity?.name || 'Community detail'}
        onClose={() => setSelectedCommunity(null)}
        maxWidth="560px"
      >
        {selectedCommunity && (
          <div className="admin-detail-grid">
            <div>
              <span className="admin-detail-label">Type</span>
              <p>{selectedCommunity.type}</p>
            </div>
            <div>
              <span className="admin-detail-label">Status</span>
              <AdminStatusBadge value={selectedCommunity.status} />
            </div>
            <div>
              <span className="admin-detail-label">Member Count</span>
              <p>{selectedCommunity.memberCount}</p>
            </div>
            <div>
              <span className="admin-detail-label">Request Count</span>
              <p>{selectedCommunity.requestCount}</p>
            </div>
            <div className="admin-detail-span-two">
              <span className="admin-detail-label">Address</span>
              <p>{selectedCommunity.address}</p>
            </div>
            <div className="admin-detail-span-two">
              <span className="admin-detail-label">Description</span>
              <p>{selectedCommunity.description}</p>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
