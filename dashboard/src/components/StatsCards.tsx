'use client';

import React from 'react';
import { FileText, ShieldAlert, AlertCircle, IndianRupee } from 'lucide-react';

export interface StatsCardsProps {
  data: any[];
}

export default function StatsCards({ data = [] }: StatsCardsProps) {
  const totalClaims = data.length;
  
  let flaggedCount = 0;
  let inconclusiveCount = 0;
  let totalSumInsured = 0;

  data.forEach(row => {
    if (row.fraud_label === 'MISMATCH') flaggedCount++;
    if (row.fraud_label === 'INCONCLUSIVE') inconclusiveCount++;
    
    const sumInsured = parseFloat(row.pmfby_sum_insured_inr);
    if (!isNaN(sumInsured)) {
      totalSumInsured += sumInsured;
    }
  });

  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)}Cr`;
    } else if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)}L`;
    } else {
      return `₹${val.toLocaleString('en-IN')}`;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Claims */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500 p-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Total Claims</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{totalClaims}</p>
        </div>
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          <FileText size={24} />
        </div>
      </div>

      {/* Flagged (Mismatch) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-red-500 p-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Flagged (Mismatch)</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{flaggedCount}</p>
        </div>
        <div className="p-2 bg-red-50 rounded-lg text-red-600">
          <ShieldAlert size={24} />
        </div>
      </div>

      {/* Inconclusive */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-amber-500 p-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Inconclusive</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{inconclusiveCount}</p>
        </div>
        <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
          <AlertCircle size={24} />
        </div>
      </div>

      {/* Total Sum Insured */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-500 p-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Total Sum Insured</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(totalSumInsured)}</p>
        </div>
        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
          <IndianRupee size={24} />
        </div>
      </div>
    </div>
  );
}
