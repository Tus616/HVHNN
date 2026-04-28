export default function AdminModal({ open, title, children, onClose, maxWidth = '720px' }) {
  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admin-modal-card" style={{ maxWidth }}>
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close modal">
            x
          </button>
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );
}
