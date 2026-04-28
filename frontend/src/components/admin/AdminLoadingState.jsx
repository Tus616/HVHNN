export default function AdminLoadingState({ label = 'Loading admin data...' }) {
  return (
    <div className="admin-state-card">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}
