import { cloneElement, forwardRef, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, ChevronDown, Info, Loader2, MapPin, Search, User, X, XCircle } from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';

const variantClass = (base, variant) => `${base} ${base}--${variant || 'default'}`;

export const Button = forwardRef(function Button({
  as: As = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}, ref) {
  const Component = props.to ? Link : As;
  return (
    <Component
      ref={ref}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 size={16} className="ui-spin" aria-hidden="true" />}
      {children}
    </Component>
  );
});

export const IconButton = forwardRef(function IconButton({ label, children, className = '', ...props }, ref) {
  return (
    <button ref={ref} type="button" className={`ui-icon-button ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
});

export function Card({ className = '', children, ...props }) {
  return <section className={`ui-card ${className}`} {...props}>{children}</section>;
}

export function PageHeader({ eyebrow, title, description, action, children }) {
  return (
    <header className="ui-page-header">
      <div>
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="ui-page-header__action">{action}</div>}
      {children}
    </header>
  );
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="ui-section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function FormField({ label, error, hint, children, htmlFor }) {
  const fallbackId = useId();
  const id = htmlFor || children?.props?.id || fallbackId;
  const field = isValidElement(children) ? cloneElement(children, { id }) : children;
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      {field}
      {hint && !error && <p className="ui-field__hint">{hint}</p>}
      {error && <p className="ui-field__error" role="alert">{error}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`ui-input ${className}`} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`ui-input ui-textarea ${className}`} {...props} />;
});

export const Select = forwardRef(function Select({ className = '', ...props }, ref) {
  return <select ref={ref} className={`ui-input ui-select ${className}`} {...props} />;
});

export function Checkbox({ label, checked, onChange, ...props }) {
  return (
    <label className="ui-check">
      <input type="checkbox" checked={checked} onChange={onChange} {...props} />
      <span>{label}</span>
    </label>
  );
}

export function RadioGroup({ label, name, value, options, onChange }) {
  return (
    <fieldset className="ui-radio-group">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Switch({ label, checked, onChange, description, disabled = false }) {
  return (
    <label className={`ui-switch-row ${disabled ? 'is-disabled' : ''}`}>
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className={`ui-switch ${checked ? 'is-on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} disabled={disabled} />
        <span />
      </span>
    </label>
  );
}

export const SearchInput = forwardRef(function SearchInput({ className = '', ...props }, ref) {
  return (
    <span className={`ui-search ${className}`}>
      <Search size={17} aria-hidden="true" />
      <input ref={ref} type="search" {...props} />
    </span>
  );
});

export const DateTimeInput = forwardRef(function DateTimeInput({ className = '', ...props }, ref) {
  return <input ref={ref} type="datetime-local" className={`ui-input ${className}`} {...props} />;
});

export function Avatar({ name = 'User', src, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
  const resolvedSrc = typeof src === 'string' && src.startsWith('/api/')
    ? `${API_BASE_URL.replace(/\/api$/, '')}${src}`
    : src;
  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);
  const showImage = Boolean(resolvedSrc) && !failed;
  return (
    <span className={`ui-avatar ui-avatar--${size}`} aria-label={name}>
      {showImage ? <img src={resolvedSrc} alt="" loading="lazy" onError={() => setFailed(true)} /> : <>{initials || <User size={16} aria-hidden="true" />}</>}
    </span>
  );
}

export function Badge({ variant = 'default', children, className = '' }) {
  return <span className={`ui-badge ui-badge--${variant} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const value = String(status || 'UNKNOWN').toUpperCase();
  const variant = value.includes('OPEN') ? 'info'
    : value.includes('PROGRESS') || value.includes('ASSIGNED') ? 'warning'
      : value.includes('COMPLETE') ? 'success'
        : value.includes('CANCEL') || value.includes('REJECT') ? 'danger'
          : 'default';
  return <Badge variant={variant}>{value.replace(/_/g, ' ')}</Badge>;
}

export function UrgencyBadge({ urgency }) {
  const value = String(urgency || 'MEDIUM').toUpperCase();
  return <Badge variant={`urgency-${value.toLowerCase()}`}>{value}</Badge>;
}

export function RoleBadge({ role }) {
  const value = String(role || 'MEMBER').toUpperCase();
  const label = value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return <Badge variant={value.includes('OWNER') || value.includes('ADMIN') ? 'info' : 'default'}>{label}</Badge>;
}

export function StatCard({ label, value, hint }) {
  return (
    <Card className="ui-stat-card">
      <small>{label}</small>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </Card>
  );
}

export function EmptyState({ title, message, actionLabel, actionTo, onAction }) {
  return (
    <div className="ui-empty">
      <Info size={34} aria-hidden="true" />
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {actionLabel && (actionTo
        ? <Button to={actionTo}>{actionLabel}</Button>
        : <Button type="button" onClick={onAction}>{actionLabel}</Button>)}
    </div>
  );
}

export function PermissionDeniedState({ message = 'You do not have permission to view this page.' }) {
  return <ErrorState title="Permission denied" message={message} />;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="ui-error" role="alert">
      <AlertTriangle size={34} aria-hidden="true" />
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {onRetry && <Button type="button" variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="ui-loading spinner" role="status"><Loader2 className="ui-spin" size={24} /> <span>{label}</span></div>;
}

export function Skeleton({ lines = 3 }) {
  return <div className="ui-skeleton" aria-hidden="true">{Array.from({ length: lines }).map((_, index) => <span key={index} />)}</div>;
}

export function Alert({ variant = 'info', title, children }) {
  const Icon = variant === 'success' ? CheckCircle : variant === 'danger' ? XCircle : variant === 'warning' ? AlertTriangle : Info;
  return (
    <div className={variantClass('ui-alert', variant)} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>{title && <strong>{title}</strong>}{children && <p>{children}</p>}</div>
    </div>
  );
}

export function Modal({ open, title, children, onClose, footer, destructive = false }) {
  const dialogRef = useRef(null);
  const lastFocus = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
      if (event.key !== 'Tab' || !dialog) return;
      const focusables = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      lastFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="ui-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div
        ref={dialogRef}
        className={`ui-modal ${destructive ? 'is-destructive' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="ui-modal__header">
          <h2>{title}</h2>
          <IconButton label="Close dialog" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title = 'Confirm action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      destructive={destructive}
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button type="button" variant={destructive ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      <p>{message}</p>
    </Modal>
  );
}

export function Drawer({ open, title, children, onClose }) {
  return (
    <div className={`ui-drawer-overlay ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <aside className="ui-drawer" aria-label={title}>
        <div className="ui-drawer__header">
          <h2>{title}</h2>
          <IconButton label="Close drawer" onClick={onClose}><X size={18} /></IconButton>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Tooltip({ label, children }) {
  return <span className="ui-tooltip" data-tooltip={label}>{children}</span>;
}

export function DropdownMenu({ label, children }) {
  const summaryLabel = typeof label === 'string' ? label : 'Open menu';
  return (
    <details className="ui-dropdown">
      <summary aria-label={summaryLabel}>
        <span aria-hidden={typeof label === 'string' ? undefined : true}>{label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="ui-dropdown__menu">{children}</div>
    </details>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="ui-tabs">
      <div role="tablist" aria-label="Sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={active === tab.id ? 'is-active' : ''}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => active === tab.id && (
        <section key={tab.id} role="tabpanel" tabIndex={0}>{tab.content}</section>
      ))}
    </div>
  );
}

export function Pagination({ page, hasMore, onPrevious, onNext, loading = false }) {
  return (
    <nav className="ui-pagination" aria-label="Pagination">
      <Button type="button" variant="secondary" disabled={page <= 0 || loading} onClick={onPrevious}>Previous</Button>
      <span>Page {page + 1}</span>
      <Button type="button" variant="secondary" disabled={!hasMore || loading} onClick={onNext}>Next</Button>
    </nav>
  );
}

export function Breadcrumb({ items }) {
  return (
    <nav className="ui-breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        item.to && index < items.length - 1
          ? <Link key={item.label} to={item.to}>{item.label}</Link>
          : <span key={item.label} aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
      ))}
    </nav>
  );
}

export function UserSummary({ user, action }) {
  const name = user?.name || user?.fullName || user?.email || 'Sahay member';
  return (
    <div className="ui-summary">
      <Avatar name={name} src={user?.avatarUrl || user?.profileImage} />
      <span>
        <strong>{name}</strong>
        {user?.role && <small>{String(user.role).replace(/_/g, ' ')}</small>}
      </span>
      {action}
    </div>
  );
}

export function LocationSummary({ location, privacy = 'Approximate location' }) {
  const label = location?.displayName || location?.address || location?.city || privacy;
  return (
    <span className="ui-location-summary">
      <MapPin size={16} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function RelativeTimestamp({ value }) {
  const date = value ? new Date(value) : null;
  return <time dateTime={date?.toISOString?.() || ''}>{date ? date.toLocaleString() : 'Unknown time'}</time>;
}
