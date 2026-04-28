import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminLoadingState from '../../components/admin/AdminLoadingState';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import RequestDetailModal from '../../components/admin/RequestDetailModal';
import { adminApi } from '../../services/adminApi';

const DEFAULT_FILTERS = {
  category: '',
  urgency: '',
  status: '',
  search: '',
  page: 0,
  size: 10,
};

export default function AdminRequestsPage() {
  const { user, showToast } = useOutletContext();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [requestPage, setRequestPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadRequests() {
      setLoading(true);

      try {
        const response = await adminApi.getRequests(filters, user);
        if (!active) return;
        setRequestPage(response.data);
      } catch (error) {
        if (!active) return;
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRequests();

    return () => {
      active = false;
    };
  }, [filters, user]);

  const rows = requestPage?.items || [];

  const pageSummary = useMemo(() => {
    if (!requestPage) return '0 requests';
    return `${requestPage.totalItems} request${requestPage.totalItems === 1 ? '' : 's'} found`;
  }, [requestPage]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === 'page' ? value : 0,
    }));
  }

  async function runRowAction(type, request) {
    try {
      if (type === 'close') {
        await adminApi.closeRequest(request.id);
        setRequestPage((current) => ({
          ...current,
          items: current.items.map((entry) => (
            entry.id === request.id ? { ...entry, status: 'RESOLVED' } : entry
          )),
        }));
        showToast({ type: 'success', title: 'Request closed', message: `${request.id} is now marked as resolved.` });
      } else {
        await adminApi.flagRequest(request.id);
        setRequestPage((current) => ({
          ...current,
          items: current.items.map((entry) => (
            entry.id === request.id ? { ...entry, flagged: true } : entry
          )),
        }));
        showToast({ type: 'warning', title: 'Request flagged', message: `${request.id} was marked for review.` });
      }
    } catch (error) {
      console.error(error);
      showToast({ type: 'danger', title: 'Action failed', message: 'Please try again.' });
    } finally {
      setConfirmation(null);
    }
  }

  if (loading && !requestPage) {
    return <AdminLoadingState label="Loading request management..." />;
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">Request Management</p>
          <h2>Manage active help requests</h2>
          <p>{pageSummary}</p>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-filter-grid">
          <select
            className="admin-input"
            value={filters.category}
            onChange={(event) => updateFilter('category', event.target.value)}
          >
            <option value="">All Categories</option>
            <option value="BLOOD">Blood</option>
            <option value="MEDICAL">Medical</option>
            <option value="FOOD">Food</option>
            <option value="GENERAL">General</option>
          </select>

          <select
            className="admin-input"
            value={filters.urgency}
            onChange={(event) => updateFilter('urgency', event.target.value)}
          >
            <option value="">All Urgency</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            className="admin-input"
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <input
            type="search"
            className="admin-input"
            placeholder="Search by keyword"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
        </div>

        {rows.length === 0 ? (
          <AdminEmptyState
            title="No requests match these filters"
            description="Try widening the filters or clearing the search query."
          />
        ) : (
          <>
            <div className="admin-table-shell">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Raised By</th>
                    <th>Location</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((request) => (
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
                      <td>{request.location}</td>
                      <td>{new Date(request.createdAt).toLocaleString()}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSelectedRequest(request)}>
                            View Detail
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-success"
                            onClick={() => setConfirmation({ type: 'close', request })}
                          >
                            Close Request
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger"
                            onClick={() => setConfirmation({ type: 'flag', request })}
                          >
                            Flag
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminPagination
              page={requestPage.page}
              totalPages={requestPage.totalPages}
              onPageChange={(pageNumber) => updateFilter('page', pageNumber)}
            />
          </>
        )}
      </section>

      <RequestDetailModal request={selectedRequest} open={Boolean(selectedRequest)} onClose={() => setSelectedRequest(null)} />

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.type === 'close' ? 'Close Request' : 'Flag Request'}
        description={
          confirmation?.type === 'close'
            ? `Mark ${confirmation?.request?.id || 'this request'} as resolved?`
            : `Flag ${confirmation?.request?.id || 'this request'} as suspicious for manual review?`
        }
        confirmLabel={confirmation?.type === 'close' ? 'Close Request' : 'Flag Request'}
        tone={confirmation?.type === 'close' ? 'success' : 'danger'}
        onClose={() => setConfirmation(null)}
        onConfirm={() => runRowAction(confirmation.type, confirmation.request)}
      />
    </div>
  );
}
