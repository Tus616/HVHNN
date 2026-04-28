import AdminModal from './AdminModal';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  onConfirm,
  onClose,
}) {
  return (
    <AdminModal open={open} title={title} onClose={onClose} maxWidth="460px">
      <p className="admin-confirm-copy">{description}</p>
      <div className="admin-modal-actions">
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`admin-btn ${tone === 'danger' ? 'admin-btn-danger' : tone === 'success' ? 'admin-btn-success' : 'admin-btn-primary'}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </AdminModal>
  );
}
