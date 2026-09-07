'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { HelpCircle } from 'lucide-react';

export interface SignalCardProps {
  title: string;
  status: 'supports' | 'contradicts' | 'unavailable' | 'inconclusive';
  icon?: LucideIcon;
  value?: string;
  detail?: string;
  children?: React.ReactNode;
  subtitle?: string;
}

const STATUS_CONFIG: Record<string, { label: string; borderColor: string; textColor: string }> = {
  supports:     { label: 'Supports loss',       borderColor: 'border-l-flag-green',  textColor: 'text-flag-green border-flag-green/40' },
  contradicts:  { label: 'Contradicts claim',    borderColor: 'border-l-flag-red',    textColor: 'text-flag-red border-flag-red/40' },
  inconclusive: { label: 'Inconclusive',         borderColor: 'border-l-flag-amber',  textColor: 'text-flag-amber border-flag-amber/40' },
  unavailable:  { label: 'No data (safeguard)',  borderColor: 'border-l-rule',         textColor: 'text-ink-secondary border-rule' },
};

export default function SignalCard({
  title,
  status,
  icon: IconComponent,
  value,
  detail,
  children,
  subtitle
}: SignalCardProps) {
  const Icon = IconComponent || HelpCircle;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unavailable;

  return (
    <div
      className={`rounded bg-white border border-rule border-l-[3px] ${config.borderColor} p-6 flex flex-col justify-between`}
    >
      <div>
        {/* Header: icon, title, status badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-ink-secondary shrink-0" />
            <div>
              <h3 className="font-semibold text-sm text-ink">{title}</h3>
              {subtitle && <p className="text-[11px] text-ink-secondary">{subtitle}</p>}
            </div>
          </div>

          <span
            className={`inline-flex items-center text-[11px] font-medium px-1.5 py-px rounded-sm border bg-white whitespace-nowrap ${config.textColor}`}
          >
            {config.label}
          </span>
        </div>

        {/* Value & detail */}
        {value && (
          <p className={`font-data text-lg font-bold mt-1 ${status === 'unavailable' ? 'text-ink-disabled' : 'text-ink'}`}>
            {value}
          </p>
        )}
        {detail && <p className="text-xs text-ink-secondary mt-1 leading-relaxed">{detail}</p>}
      </div>

      {children && (
        <div className="mt-3 pt-3 border-t border-rule/50">{children}</div>
      )}
    </div>
  );
}
