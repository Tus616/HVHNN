export default function BrandLogo({ variant = 'full', className = '' }) {
  const mark = (
    <svg className="brand-logo__symbol" viewBox="0 0 48 48" role="img" aria-label="Sahay community heart logo">
      <path d="M24 38c-1.3-1.1-2.8-2.2-4.3-3.4C12.5 28.9 8 25.1 8 18.8 8 13.9 11.7 10 16.4 10c2.9 0 5.5 1.4 7.1 3.7C25.1 11.4 27.7 10 30.6 10 35.3 10 39 13.9 39 18.8c0 6.3-4.5 10.1-11.7 15.8-1.5 1.2-3 2.3-3.3 3.4Z" />
      <circle cx="16.5" cy="17.5" r="3.2" />
      <circle cx="31.5" cy="17.5" r="3.2" />
      <circle cx="24" cy="29" r="3.2" />
      <path d="M19.5 19.7 24 26m4.5-6.3L24 26" />
    </svg>
  );

  if (variant === 'mark') {
    return <span className={`brand-logo brand-logo--mark ${className}`}>{mark}</span>;
  }

  if (variant === 'compact') {
    return (
      <span className={`brand-logo brand-logo--compact ${className}`}>
        {mark}
        <span className="brand-logo__text">
          <strong>Sahay</strong>
        </span>
      </span>
    );
  }

  return (
    <span className={`brand-logo brand-logo--full ${className}`}>
      {mark}
      <span className="brand-logo__text">
        <strong>Sahay</strong>
        <small>Help Where It Matters</small>
      </span>
    </span>
  );
}
