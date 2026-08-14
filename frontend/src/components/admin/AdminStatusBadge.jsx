import { humanizeEnum } from '../../utils/displayFormat';

const STATUS_VARIANTS = {
  HIGH: 'admin-badge-danger',
  MEDIUM: 'admin-badge-warning',
  LOW: 'admin-badge-success',
  PENDING: 'admin-badge-warning',
  ACTIVE: 'admin-badge-primary',
  RESOLVED: 'admin-badge-success',
  VERIFIED: 'admin-badge-success',
  UNVERIFIED: 'admin-badge-muted',
  BLOCKED: 'admin-badge-danger',
  ADMIN: 'admin-badge-primary',
  VOLUNTEER: 'admin-badge-success',
  USER: 'admin-badge-muted',
  APPROVED: 'admin-badge-success',
  DEACTIVATED: 'admin-badge-danger',
};

export default function AdminStatusBadge({ value, prefix = '' }) {
  const normalizedValue = String(value || '').toUpperCase();
  const variant = STATUS_VARIANTS[normalizedValue] || 'admin-badge-muted';

  return (
    <span className={`admin-badge ${variant}`}>
      {prefix}
      {humanizeEnum(value)}
    </span>
  );
}
