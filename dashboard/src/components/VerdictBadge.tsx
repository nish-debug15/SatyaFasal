'use client';

import React from 'react';
import { ShieldAlert, AlertCircle, ShieldCheck, HelpCircle } from 'lucide-react';

export interface VerdictBadgeProps {
  verdict: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export default function VerdictBadge({ verdict, size = 'md', showIcon = false }: VerdictBadgeProps) {
  const v = verdict?.toUpperCase() || 'UNKNOWN';

  let colorClasses = 'bg-gray-100 text-gray-700 border-gray-200';
  let Icon = HelpCircle;

  if (v === 'MISMATCH') {
    colorClasses = 'bg-red-100 text-red-700 border-red-200';
    Icon = ShieldAlert;
  } else if (v === 'INCONCLUSIVE') {
    colorClasses = 'bg-amber-100 text-amber-700 border-amber-200';
    Icon = AlertCircle;
  } else if (v === 'CONSISTENT') {
    colorClasses = 'bg-emerald-100 text-emerald-700 border-emerald-200';
    Icon = ShieldCheck;
  } else if (v === 'PARTIAL') {
    colorClasses = 'bg-blue-100 text-blue-700 border-blue-200';
    Icon = HelpCircle;
  }

  let sizeClasses = 'text-xs px-2.5 py-0.5 gap-1';
  let iconSize = 14;

  if (size === 'sm') {
    sizeClasses = 'text-[10px] px-2 py-0.5 gap-1';
    iconSize = 12;
  } else if (size === 'lg') {
    sizeClasses = 'text-sm px-3 py-1 gap-1.5';
    iconSize = 16;
  }

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${colorClasses} ${sizeClasses}`}>
      {showIcon && <Icon size={iconSize} />}
      {v}
    </span>
  );
}
