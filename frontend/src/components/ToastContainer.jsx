import { useNotifications } from '../context/NotificationContext';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const TOAST_ICONS = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  warning: <AlertCircle size={18} className="text-amber-500" />,
  info: <Info size={18} className="text-blue-500" />,
};

export default function ToastContainer() {
  const { toasts, removeToast } = useNotifications();

  return (
    <div className="toast-container" role="status" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-icon">
            {TOAST_ICONS[toast.type] || TOAST_ICONS.info}
          </div>
          <div className="toast-content">
            {toast.title && <div className="font-bold text-xs">{toast.title}</div>}
            <div className="text-sm opacity-90">{toast.message}</div>
          </div>
          <button 
            onClick={() => removeToast(toast.id)} 
            className="ml-auto p-1 hover:bg-black/5 rounded-full transition-colors"
            aria-label={`Dismiss ${toast.title || 'notification'}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
