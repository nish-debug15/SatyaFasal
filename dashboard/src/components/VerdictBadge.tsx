'use client';

import React from 'react';
import { ShieldAlert, CircleAlert, ShieldCheck, CircleHelp, MinusCircle } from 'lucide-react';

export interface VerdictBadgeProps {
  verdict: string | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

export default function VerdictBadge({ 
  verdict, 
  size = 'md', 
  showIcon = true,
  pulse = false,
  className = '' 
}: VerdictBadgeProps) {
  const v = verdict?.toUpperCase() || 'UNKNOWN';

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';
  let IconComponent = CircleHelp;
  let label = v;

  if (v === 'MISMATCH' || v === 'INCONSISTENT') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200/80 shadow-rose-500/10';
    dotColor = 'bg-rose-500';
    IconComponent = ShieldAlert;
    label = v === 'INCONSISTENT' ? 'INCONSISTENT' : 'MISMATCH';
  } else if (v === 'INCONCLUSIVE') {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-200/80 shadow-amber-500/10';
    dotColor = 'bg-amber-500';
    IconComponent = CircleAlert;
    label = 'INCONCLUSIVE';
  } else if (v === 'CONSISTENT') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-emerald-500/10';
    dotColor = 'bg-emerald-500';
    IconComponent = ShieldCheck;
    label = 'CONSISTENT';
  } else if (v === 'PARTIAL') {
    colorClasses = 'bg-sky-50 text-sky-700 border-sky-200/80 shadow-sky-500/10';
    dotColor = 'bg-sky-500';
    IconComponent = CircleHelp;
    label = 'PARTIAL';
  } else if (v === 'NO_DATA') {
    colorClasses = 'bg-gray-100 text-gray-500 border-gray-200';
    dotColor = 'bg-gray-400';
    IconComponent = MinusCircle;
    label = 'NO DATA';
  }

  // Size variations
  let sizeClasses = 'text-xs px-2.5 py-1 gap-1.5 font-medium';
  let iconSize = 13;

  if (size === 'xs') {
    sizeClasses = 'text-[11px] px-2 py-0.5 gap-1 font-medium';
    iconSize = 11;
  } else if (size === 'sm') {
    sizeClasses = 'text-xs px-2.5 py-0.5 gap-1.5 font-medium';
    iconSize = 12;
  } else if (size === 'lg') {
    sizeClasses = 'text-sm px-3.5 py-1.5 gap-2 font-semibold shadow-xs';
    iconSize = 16;
  } else if (size === 'xl') {
    sizeClasses = 'text-base px-5 py-2.5 gap-2.5 font-bold shadow-sm';
    iconSize = 20;
  }

  // Fallback safe icon rendering
  const RenderIcon = IconComponent || CircleHelp;

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-all duration-150 tracking-wide uppercase ${colorClasses} ${sizeClasses} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2 mr-0.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      {showIcon && <RenderIcon size={iconSize} className="shrink-0 stroke-[2.2]" />}
      <span>{label}</span>
    </span>
  );
}
