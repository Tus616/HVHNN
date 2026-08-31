export default function StatsCard({ 
  title, 
  value, 
  tone = 'blue', 
  helper,
}) {
  return (
    <div className="admin-stats-card card card-glass-lite">
      <span className={`admin-stats-tone admin-stats-tone-${tone}`} />
      <div className="flex justify-between items-start">
        <div>
          <p className="admin-stats-title text-xs font-bold uppercase tracking-wider text-muted mb-1">
            {title}
          </p>
          <strong className="admin-stats-value text-2xl font-black letter-spacing-tighter">
            {value}
          </strong>
        </div>
      </div>

      {helper && (
        <div className="admin-stats-helper mt-2 text-xs opacity-60">
          {helper}
        </div>
      )}
    </div>
  );
}
