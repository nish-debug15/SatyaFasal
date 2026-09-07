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
        className={`group bg-surface rounded p-5 border transition-all cursor-pointer ${
          activeFilter === 'ALL'
            ? 'border-ink ring-1 ring-ink'
            : 'border-rule hover:border-ink-secondary'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-ink-secondary">Total claims evaluated</span>
            <p className="mt-2 text-2xl font-bold font-data text-ink tracking-tight">{totalClaims}</p>
          </div>
          <div className="p-2 border border-rule rounded text-ink-secondary bg-white">
            <FileText className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-rule/50 text-xs text-ink-secondary">
          <span>Kharif 2024 Pilot</span>
          <span className="font-medium text-ink group-hover:underline flex items-center gap-0.5">
            View all <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 2. Flagged Mismatch */}
      <div
        onClick={() => onFilterSelect && onFilterSelect('MISMATCH')}
        className={`group bg-surface rounded p-5 border transition-all cursor-pointer ${
          activeFilter === 'MISMATCH'
            ? 'border-flag-red ring-1 ring-flag-red'
            : 'border-rule hover:border-flag-red/50'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-flag-red">Flagged (mismatch)</span>
            <p className="mt-2 text-2xl font-bold font-data text-ink tracking-tight">{flaggedCount}</p>
          </div>
          <div className="p-2 border border-rule rounded text-ink-secondary bg-white">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-rule/50 text-xs text-ink-secondary">
          <span className="font-medium font-data text-flag-red border border-flag-red/30 px-1.5 py-px rounded-sm bg-white">
            {flaggedPct}% of total
          </span>
          <span className="font-medium text-ink group-hover:underline flex items-center gap-0.5">
            Filter flagged <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 3. Inconclusive Safeguard */}
      <div
        onClick={() => onFilterSelect && onFilterSelect('INCONCLUSIVE')}
        className={`group bg-surface rounded p-5 border transition-all cursor-pointer ${
          activeFilter === 'INCONCLUSIVE'
            ? 'border-flag-amber ring-1 ring-flag-amber'
            : 'border-rule hover:border-flag-amber/50'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-flag-amber">Inconclusive (safeguard)</span>
            <p className="mt-2 text-2xl font-bold font-data text-ink tracking-tight">{inconclusiveCount}</p>
          </div>
          <div className="p-2 border border-rule rounded text-ink-secondary bg-white">
            <CircleAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-rule/50 text-xs text-ink-secondary">
          <span className="font-medium font-data text-flag-amber border border-flag-amber/30 px-1.5 py-px rounded-sm bg-white">
            {inconclusivePct}% needs survey
          </span>
          <span className="font-medium text-ink group-hover:underline flex items-center gap-0.5">
            Filter <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 4. Total Sum Insured */}
      <div className="bg-surface rounded p-5 border border-rule transition-all">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-ink-secondary">Total sum insured</span>
            <p className="mt-2 text-2xl font-bold font-data text-ink tracking-tight">{formatCurrency(totalSumInsured)}</p>
          </div>
          <div className="p-2 border border-rule rounded text-ink-secondary bg-white">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-rule/50 text-xs text-ink-secondary">
          <span>Claims total:</span>
          <span className="font-bold font-data text-ink">{formatCurrency(totalClaimAmount)}</span>
        </div>
      </div>
    </div>
  );
}
