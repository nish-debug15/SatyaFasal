'use client';

import React from 'react';
import { FileText, ShieldAlert, CircleAlert, IndianRupee, ArrowUpRight } from 'lucide-react';

export interface StatsCardsProps {
  data: any[];
  activeFilter?: string;
  onFilterSelect?: (filter: string) => void;
}

export default function StatsCards({
  data = [],
  activeFilter,
  onFilterSelect
}: StatsCardsProps) {
  const totalClaims = data.length;

  let flaggedCount = 0;
  let inconclusiveCount = 0;
  let consistentCount = 0;
  let totalSumInsured = 0;
  let totalClaimAmount = 0;

  data.forEach(row => {
    const fraud = (row.fraud_label || '').toUpperCase();
    if (fraud === 'MISMATCH' || fraud === 'INCONSISTENT') flaggedCount++;
    else if (fraud === 'INCONCLUSIVE') inconclusiveCount++;
    else if (fraud === 'CONSISTENT') consistentCount++;

    const sumInsured = parseFloat(row.pmfby_sum_insured_inr);
    if (!isNaN(sumInsured)) totalSumInsured += sumInsured;

    const claimAmt = parseFloat(row.pmfby_claim_amount_inr);
    if (!isNaN(claimAmt)) totalClaimAmount += claimAmt;
  });

  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    } else if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} Lakh`;
    } else {
      return `₹${val.toLocaleString('en-IN')}`;
    }
  };

  const flaggedPct = totalClaims > 0 ? ((flaggedCount / totalClaims) * 100).toFixed(1) : '0';
  const inconclusivePct = totalClaims > 0 ? ((inconclusiveCount / totalClaims) * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Claims */}
      <div
        onClick={() => onFilterSelect && onFilterSelect('ALL')}
        className={`group bg-white rounded-2xl p-5 border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
          activeFilter === 'ALL'
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-slate-200/80 hover:border-slate-300'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Claims Evaluated</span>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">{totalClaims}</p>
          </div>
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Kharif 2024 Pilot</span>
          <span className="font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
            View all <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 2. Flagged Mismatch */}
      <div
        onClick={() => onFilterSelect && onFilterSelect('MISMATCH')}
        className={`group bg-white rounded-2xl p-5 border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md relative overflow-hidden ${
          activeFilter === 'MISMATCH'
            ? 'border-rose-500 ring-2 ring-rose-500/20'
            : 'border-slate-200/80 hover:border-rose-200'
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600" />
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Flagged (Mismatch)</span>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">{flaggedCount}</p>
          </div>
          <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 border border-rose-100 group-hover:scale-105 transition-transform">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            {flaggedPct}% of total
          </span>
          <span className="font-semibold text-rose-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
            Filter flagged <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 3. Inconclusive Safeguard */}
      <div
        onClick={() => onFilterSelect && onFilterSelect('INCONCLUSIVE')}
        className={`group bg-white rounded-2xl p-5 border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md relative overflow-hidden ${
          activeFilter === 'INCONCLUSIVE'
            ? 'border-amber-500 ring-2 ring-amber-500/20'
            : 'border-slate-200/80 hover:border-amber-200'
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Inconclusive (Safeguard)</span>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">{inconclusiveCount}</p>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100 group-hover:scale-105 transition-transform">
            <CircleAlert className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
            {inconclusivePct}% Needs Survey
          </span>
          <span className="font-semibold text-amber-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
            Filter <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 4. Total Sum Insured */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Total Sum Insured</span>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(totalSumInsured)}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Claims Total:</span>
          <span className="font-bold text-slate-900">{formatCurrency(totalClaimAmount)}</span>
        </div>
      </div>
    </div>
  );
}
