import { Link } from 'react-router-dom';
import { formatDistance, timeAgo } from '../../utils/volunteer';

const CATEGORY_ICONS = {
  BLOOD_DONATION: '🩸',
  MEDICAL: '🏥',
  FOOD: '🍲',
  TRANSPORT: '🚗',
  EMERGENCY: '🚨',
  GENERAL: '🤝',
};

const URGENCY_CLASS = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-high',
  MEDIUM: 'badge-medium',
  LOW: 'badge-low',
};

export default function VolunteerRequestCard({
  request,
  children,
  footer,
  compact = false,
}) {
  return (
    <div className={`request-card volunteer-request-card ${compact ? 'compact' : ''}`} data-urgency={request.urgency}>
      <div className="request-header">
        <div>
          <div className="request-title">{request.title}</div>
          <div className="volunteer-request-subtitle">
            {request.requester?.fullName || 'Requester'} • {timeAgo(request.createdAt)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span className={`badge ${URGENCY_CLASS[request.urgency] || ''}`}>{request.urgency}</span>
          <span className="badge badge-category">
            {CATEGORY_ICONS[request.category] || '📋'} {request.category?.replaceAll('_', ' ')}
          </span>
        </div>
      </div>

      <div className="request-desc">{request.description}</div>

      <div className="volunteer-request-meta">
        <span>{formatDistance(request.distanceKm)}</span>
        {request.address && <span>📍 {request.address}</span>}
        {request.contactPhone && <span>📞 {request.contactPhone}</span>}
      </div>

      {children}

      <div className="volunteer-request-footer">
        <Link to={`/request/${request.id}`} className="btn btn-secondary btn-sm">
          Open Details
        </Link>
        {footer}
      </div>
    </div>
  );
}
