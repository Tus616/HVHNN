import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatsCard({ 
  title, 
  value, 
  tone = 'blue', 
  helper, 
  trendValue, 
  trendDirection = 'up' 
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
        
        {trendValue && (
          <div className={`flex items-center gap-1 font-bold text-xs ${trendDirection === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trendDirection === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      {helper && (
        <div className="admin-stats-helper mt-2 text-xs opacity-60">
          {helper}
        </div>
      )}
    </div>
  );
}
