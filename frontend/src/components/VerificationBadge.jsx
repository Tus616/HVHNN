import React from 'react';
import { Shield, ShieldCheck, Sparkles } from 'lucide-react';

const VERIFICATION_LEVELS = {
  BASIC: {
    color: 'text-slate-500',
    icon: Shield,
    label: 'Basic Identity',
    bg: 'bg-slate-50',
    border: 'border-slate-200'
  },
  VERIFIED: {
    color: 'text-blue-600',
    icon: ShieldCheck,
    label: 'Institution Verified',
    bg: 'bg-blue-50',
    border: 'border-blue-100'
  },
  TRUSTED: {
    color: 'text-emerald-600',
    icon: ShieldCheck,
    label: 'Trusted Member',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    special: true
  }
};

export default function VerificationBadge({ level = 'BASIC', showLabel = false, size = 'md' }) {
  const config = VERIFICATION_LEVELS[level] || VERIFICATION_LEVELS.BASIC;
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
    lg: 'text-sm px-3 py-1 gap-2'
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  return (
    <div 
      className={`inline-flex items-center font-bold rounded-full border shadow-sm transition-all duration-200 hover:shadow-md ${config.bg} ${config.border} ${config.color} ${sizeClasses[size]}`}
      title={config.label}
    >
      <div className="relative flex items-center justify-center">
        <Icon size={iconSizes[size]} strokeWidth={2.5} />
        {config.special && (
          <Sparkles 
            size={iconSizes[size] / 1.5} 
            className="absolute -top-1 -right-1 text-emerald-500 animate-pulse" 
          />
        )}
      </div>
      {showLabel && <span className="uppercase tracking-wider font-extrabold">{config.label}</span>}
    </div>
  );
}
