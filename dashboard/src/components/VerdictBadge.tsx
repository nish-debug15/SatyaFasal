'use client';

import React from 'react';

export interface VerdictBadgeProps {
  verdict: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATE_MAP: Record<string, { label: string; colorClass: string }> = {
  MISMATCH:     { label: 'Mismatch',     colorClass: 'text-flag-red border-flag-red/40' },
  INCONSISTENT: { label: 'Inconsistent', colorClass: 'text-flag-red border-flag-red/40' },
  INCONCLUSIVE: { label: 'Inconclusive', colorClass: 'text-flag-amber border-flag-amber/40' },
  CONSISTENT:   { label: 'Consistent',   colorClass: 'text-flag-green border-flag-green/40' },
  PARTIAL:      { label: 'Partial',      colorClass: 'text-flag-amber border-flag-amber/40' },
  NO_DATA:      { label: 'No data',      colorClass: 'text-ink-secondary border-rule' },
};

const SIZE_MAP = {
  sm: 'text-[11px] px-1.5 py-px',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-2.5 py-1',
};

export default function VerdictBadge({
  verdict,
  size = 'md',
  className = ''
}: VerdictBadgeProps) {
  const key = (verdict || '').toUpperCase().trim();
  const state = STATE_MAP[key] || { label: key || 'Unknown', colorClass: 'text-ink-secondary border-rule' };

  return (
    <span
      className={`inline-flex items-center font-medium border bg-white rounded-sm ${state.colorClass} ${SIZE_MAP[size]} ${className}`}
    >
      {state.label}
    </span>
  );
}
