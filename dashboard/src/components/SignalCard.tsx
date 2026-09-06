'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { HelpCircle, CheckCircle2, XCircle, AlertCircle, MinusCircle } from 'lucide-react';

export interface SignalCardProps {
  title: string;
  status: 'supports' | 'contradicts' | 'unavailable' | 'inconclusive';
  icon?: LucideIcon;
  value?: string;
  detail?: string;
  children?: React.ReactNode;
  subtitle?: string;
}

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

  let borderClasses = 'border-slate-200 border-l-slate-400';
  let badgeText = 'UNAVAILABLE';
  let badgeClasses = 'bg-slate-100 text-slate-600 border-slate-200';
  let StatusIcon = MinusCircle;
  let iconBg = 'bg-slate-100 text-slate-600';

  if (status === 'supports') {
    borderClasses = 'border-slate-200 border-l-emerald-500';
    badgeText = 'SUPPORTS LOSS';
    badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    StatusIcon = CheckCircle2;
    iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200';
  } else if (status === 'contradicts') {
    borderClasses = 'border-slate-200 border-l-rose-500';
    badgeText = 'CONTRADICTS CLAIM';
    badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
    StatusIcon = XCircle;
    iconBg = 'bg-rose-50 text-rose-600 border-rose-200';
  } else if (status === 'inconclusive') {
    borderClasses = 'border-slate-200 border-l-amber-500';
    badgeText = 'INCONCLUSIVE';
    badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200';
    StatusIcon = AlertCircle;
    iconBg = 'bg-amber-50 text-amber-600 border-amber-200';
  } else if (status === 'unavailable') {
    borderClasses = 'border-slate-200 border-l-slate-300';
    badgeText = 'NO DATA (SAFEGUARD)';
    badgeClasses = 'bg-slate-100 text-slate-500 border-slate-200';
    StatusIcon = MinusCircle;
    iconBg = 'bg-slate-100 text-slate-400';
  }

  return (
    <div
      className={`rounded-xl shadow-xs border bg-white border-l-4 ${borderClasses} p-5 flex flex-col justify-between transition-all duration-150 hover:shadow-sm`}
    >
      <div>
        {/* Top bar with Icon and Status Badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border ${iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${badgeClasses}`}
          >
            <StatusIcon className="w-3 h-3" />
            <span>{badgeText}</span>
          </span>
        </div>

        {/* Content & Metrics */}
        {value && (
          <p className={`text-lg font-bold mt-1 ${status === 'unavailable' ? 'text-slate-400' : 'text-slate-900'}`}>
            {value}
          </p>
        )}
        {detail && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{detail}</p>}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">{children}</div>
    </div>
  );
}
