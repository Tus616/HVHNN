import AdminModal from './AdminModal';
import AdminStatusBadge from './AdminStatusBadge';

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

export default function RequestDetailModal({ request, open, onClose }) {
  if (!request) return null;

  return (
    <AdminModal open={open} title={`Request ${request.id}`} onClose={onClose}>
      <div className="admin-detail-grid">
        <div>
          <span className="admin-detail-label">Title</span>
          <p>{request.title}</p>
        </div>
        <div>
          <span className="admin-detail-label">Raised By</span>
          <p>{request.raisedBy}</p>
        </div>
        <div>
          <span className="admin-detail-label">Category</span>
          <AdminStatusBadge value={request.category} />
        </div>
        <div>
          <span className="admin-detail-label">Urgency</span>
          <AdminStatusBadge value={request.urgency} prefix={request.urgency === 'HIGH' ? '🔴 ' : request.urgency === 'MEDIUM' ? '🟡 ' : '🟢 '} />
        </div>
        <div>
          <span className="admin-detail-label">Status</span>
          <AdminStatusBadge value={request.status} />
        </div>
        <div>
          <span className="admin-detail-label">Community</span>
          <p>{request.communityName}</p>
        </div>
        <div>
          <span className="admin-detail-label">Location</span>
          <p>{request.location}</p>
        </div>
        <div>
          <span className="admin-detail-label">Raised At</span>
          <p>{formatDateTime(request.createdAt)}</p>
        </div>
      </div>

      <div className="admin-detail-section">
        <span className="admin-detail-label">Description</span>
        <p>{request.description}</p>
      </div>
    </AdminModal>
  );
}
