import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface DemoBadgeProps {
  label?: string;
  variant?: 'pill' | 'inline' | 'outline' | 'banner';
  className?: string;
  tooltip?: string;
}

export const DemoBadge: React.FC<DemoBadgeProps> = ({
  label = 'DEMO DATA',
  variant = 'pill',
  className = '',
  tooltip = 'Fictional demonstration data for VOLTERRA CleanTech EV scenario',
}) => {
  if (variant === 'banner') {
    return (
      <div
        className={`flex items-center justify-between px-3.5 py-1.5 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg border border-slate-700 shadow-sm ${className}`}
        title={tooltip}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-100 uppercase tracking-wider">{label}</span>
          <span className="text-slate-400 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline font-sans text-xs">
            Fictional VOLTERRA Energy Dynamics scenario for judge evaluation
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-sans hidden md:flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Deterministic mock verification pipeline active</span>
        </div>
      </div>
    );
  }

  if (variant === 'outline') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase border border-slate-300 bg-white text-slate-600 font-mono ${className}`}
        title={tooltip}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {label}
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-mono uppercase text-slate-500 tracking-wider ${className}`}
        title={tooltip}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {label}
      </span>
    );
  }

  // default 'pill'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-slate-100 text-slate-700 border border-slate-200 font-mono shadow-2xs ${className}`}
      title={tooltip}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
      <span>{label}</span>
    </span>
  );
};
