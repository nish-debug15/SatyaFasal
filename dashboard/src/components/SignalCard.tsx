'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SignalCardProps {
  title: string;
  status: 'supports' | 'contradicts' | 'unavailable' | 'inconclusive';
  icon: LucideIcon;
  value?: string;
  detail?: string;
  children?: React.ReactNode;
}

export default function SignalCard({ title, status, icon: Icon, value, detail, children }: SignalCardProps) {
  let borderClasses = 'border-l-gray-300';
  let dotClasses = 'bg-gray-400';
  let bgClasses = 'bg-white';

  if (status === 'supports') {
    borderClasses = 'border-l-emerald-500';
    dotClasses = 'bg-emerald-500';
  } else if (status === 'contradicts') {
    borderClasses = 'border-l-red-500';
    dotClasses = 'bg-red-500';
  } else if (status === 'inconclusive') {
    borderClasses = 'border-l-amber-500';
    dotClasses = 'bg-amber-500';
  } else if (status === 'unavailable') {
    borderClasses = 'border-l-gray-300';
    dotClasses = 'bg-gray-400';
    bgClasses = 'bg-gray-50 opacity-80';
  }

  return (
    <div className={`rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderClasses} ${bgClasses} p-4 flex flex-col h-full`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Icon className="w-5 h-5" />
          <h3 className="font-medium text-sm">{title}</h3>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${dotClasses}`} title={`Status: ${status}`} />
      </div>
      
      <div className="mt-auto">
        {value && (
          <p className={`font-semibold text-lg ${status === 'unavailable' ? 'text-gray-400' : 'text-gray-900'}`}>
            {value}
          </p>
        )}
        {detail && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{detail}</p>
        )}
        {children}
      </div>
    </div>
  );
}
