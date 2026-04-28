export default function AdminToast({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div className={`admin-toast admin-toast-${toast.type || 'info'}`}>
      <div>
        <strong>{toast.title || 'Notice'}</strong>
        {toast.message && <p>{toast.message}</p>}
      </div>
      <button type="button" className="admin-toast-close" onClick={onClose} aria-label="Dismiss notification">
        x
      </button>
    </div>
  );
}
