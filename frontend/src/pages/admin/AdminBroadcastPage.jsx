import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminLoadingState from '../../components/admin/AdminLoadingState';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import { adminApi } from '../../services/adminApi';
import { ErrorState } from '../../components/ui';
import { formatDateTime } from '../../utils/displayFormat';
import { normalizeApiError } from '../../utils/errors';

const MESSAGE_LIMIT = 500;

export default function AdminBroadcastPage() {
  const { user, showToast, adminRole, scopedCommunityId } = useOutletContext();
  const [communities, setCommunities] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    message: '',
    targetType: adminRole === 'COMMUNITY_ADMIN' ? 'SPECIFIC' : 'ALL',
    communityId: adminRole === 'COMMUNITY_ADMIN' ? scopedCommunityId : '',
  });

  useEffect(() => {
    let active = true;

    async function loadBroadcastPage() {
      setLoading(true);

      try {
        setError('');
        const [communityResponse, historyResponse] = await Promise.all([
          adminApi.getCommunities(user),
          adminApi.getBroadcastHistory(user),
        ]);

        if (!active) return;

        setCommunities(communityResponse.data);
        setHistory(historyResponse.data);

        if (adminRole === 'COMMUNITY_ADMIN' && !form.communityId) {
          setForm((current) => ({
            ...current,
            targetType: 'SPECIFIC',
            communityId: communityResponse.data[0]?.id || scopedCommunityId,
          }));
        }
      } catch (error) {
        if (!active) return;
        setError(normalizeApiError(error, 'Could not load broadcast center.').message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBroadcastPage();

    return () => {
      active = false;
    };
  }, [adminRole, scopedCommunityId, user]);

  const remainingCharacters = useMemo(
    () => MESSAGE_LIMIT - form.message.length,
    [form.message.length]
  );

  async function handleSendBroadcast() {
    setSending(true);

    try {
      const response = await adminApi.sendBroadcast(form, user);
      setHistory((current) => [response.entry, ...current]);
      setForm({
        message: '',
        targetType: adminRole === 'COMMUNITY_ADMIN' ? 'SPECIFIC' : 'ALL',
        communityId: adminRole === 'COMMUNITY_ADMIN' ? scopedCommunityId : '',
      });
      showToast({ type: 'success', title: 'Broadcast sent', message: 'Your message is now in broadcast history.' });
    } catch (error) {
      showToast({ type: 'danger', title: 'Broadcast failed', message: normalizeApiError(error, 'Please try again.').message });
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  }

  if (loading) {
    return <AdminLoadingState label="Loading broadcast center..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">Broadcast Notification</p>
          <h2>Send platform-wide admin updates</h2>
          <p>Use careful broadcasts for urgent coordination and verified operational notices.</p>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-form-grid">
          <div className="admin-form-field admin-form-span-two">
            <label>Message</label>
            <textarea
              className="admin-input admin-textarea"
              maxLength={MESSAGE_LIMIT}
              placeholder="Write a clear update for volunteers and community admins..."
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            />
            <div className="admin-helper-row">
              <span>Max 500 characters</span>
              <strong>{remainingCharacters} left</strong>
            </div>
          </div>

          <div className="admin-form-field">
            <label>Target</label>
            <select
              className="admin-input"
              value={form.targetType}
              onChange={(event) => setForm((current) => ({
                ...current,
                targetType: event.target.value,
                communityId: event.target.value === 'SPECIFIC' ? current.communityId : '',
              }))}
              disabled={adminRole === 'COMMUNITY_ADMIN'}
            >
              <option value="ALL">All Communities</option>
              <option value="SPECIFIC">Specific Community</option>
            </select>
          </div>

          {form.targetType === 'SPECIFIC' && (
            <div className="admin-form-field">
              <label>Community</label>
              <select
                className="admin-input"
                value={form.communityId}
                onChange={(event) => setForm((current) => ({ ...current, communityId: event.target.value }))}
              >
                <option value="">Select a community</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="admin-actions-row">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={
              sending
              || !form.message.trim()
              || (form.targetType === 'SPECIFIC' && !form.communityId)
            }
            onClick={() => setShowConfirm(true)}
          >
            {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h3>Broadcast History</h3>
            <p>Recent operational announcements sent from the admin console.</p>
          </div>
        </div>

        {history.length === 0 ? (
          <AdminEmptyState
            title="No broadcasts yet"
            description="Messages you send will appear here."
          />
        ) : (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Target</th>
                  <th>Sent By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.message.length > 90 ? `${entry.message.slice(0, 90)}...` : entry.message}</td>
                    <td>{entry.targetLabel}</td>
                    <td>{entry.sentBy}</td>
                    <td>{formatDateTime(entry.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={showConfirm}
        title="Send Broadcast"
        description="This message will be visible to the selected audience. Are you sure you want to send it now?"
        confirmLabel="Send Now"
        tone="primary"
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSendBroadcast}
      />
    </div>
  );
}
