export default function AdminEmptyState({
  title = 'No data found',
  description = 'Nothing matched the current filters yet.',
}) {
  return (
    <div className="admin-state-card admin-empty-state">
      <div className="admin-empty-icon">+</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
