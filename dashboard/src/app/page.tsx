'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StatsCards from '@/components/StatsCards';
import VerdictBadge from '@/components/VerdictBadge';
import { Search, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [fraudFilter, setFraudFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const rowsPerPage = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const { data: dbData, error: dbError } = await supabase
          .from('master_eval_dataset')
          .select('id, village_name, district, taluk, multimodal_verdict, fraud_label, fraud_confidence, pmfby_claim_amount_inr, pmfby_sum_insured_inr');

        if (dbError) throw dbError;
        setData(dbData || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch data from Supabase');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchesSearch = row.village_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) || false;
      const matchesVerdict = verdictFilter === 'ALL' || row.multimodal_verdict === verdictFilter;
      const matchesFraud = fraudFilter === 'ALL' || row.fraud_label === fraudFilter;
      return matchesSearch && matchesVerdict && matchesFraud;
    });
  }, [data, debouncedSearch, verdictFilter, fraudFilter]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, verdictFilter, fraudFilter]);

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '-';
    return '₹' + val.toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">Loading claims data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-6">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">Error Loading Data</h2>
          </div>
          <p className="mt-2 text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-50 text-red-700 font-medium rounded hover:bg-red-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">SatyaFasal</h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">Multimodal Verification Layer for PMFBY Crop Insurance Claims</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <StatsCards data={data} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-200 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <div className="relative flex-1 max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search village name..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                  value={verdictFilter}
                  onChange={(e) => setVerdictFilter(e.target.value)}
                >
                  <option value="ALL">All Verdicts</option>
                  <option value="INCONCLUSIVE">Inconclusive</option>
                  <option value="INCONSISTENT">Inconsistent</option>
                  <option value="CONSISTENT">Consistent</option>
                  <option value="PARTIAL">Partial</option>
                </select>

                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                  value={fraudFilter}
                  onChange={(e) => setFraudFilter(e.target.value)}
                >
                  <option value="ALL">All Fraud Labels</option>
                  <option value="MISMATCH">Mismatch</option>
                  <option value="INCONCLUSIVE">Inconclusive</option>
                  <option value="CONSISTENT">Consistent</option>
                  <option value="NO_DATA">No Data</option>
                </select>
                
                <div className="text-sm text-gray-500 font-medium px-2 min-w-[100px] text-right">
                  {filteredData.length} result{filteredData.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Village</th>
                  <th className="px-6 py-4">District / Taluk</th>
                  <th className="px-6 py-4">Verdict (Pipeline)</th>
                  <th className="px-6 py-4">Fraud Label (Signal)</th>
                  <th className="px-6 py-4">Confidence</th>
                  <th className="px-6 py-4">Claim Amount</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <Search className="h-8 w-8 text-gray-300 mb-2" />
                        <p>No claims found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, index) => {
                    const rowNumber = (page - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={row.id} className="hover:bg-blue-50/50 even:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-gray-500 font-medium">{rowNumber}</td>
                        <td className="px-6 py-4 font-semibold text-gray-900">{row.village_name || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="text-gray-900">{row.district || '-'}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{row.taluk || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <VerdictBadge verdict={row.multimodal_verdict} />
                        </td>
                        <td className="px-6 py-4">
                          <VerdictBadge verdict={row.fraud_label} />
                        </td>
                        <td className="px-6 py-4">
                          {row.fraud_confidence ? (
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                              row.fraud_confidence.toLowerCase() === 'high' 
                                ? 'bg-red-50 text-red-700 border-red-200' 
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}>
                              {row.fraud_confidence.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {formatCurrency(row.pmfby_claim_amount_inr)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          <Link 
                            href={`/village/${row.id}`}
                            className="text-blue-600 hover:text-blue-800 flex items-center justify-end group transition-colors"
                          >
                            View Details 
                            <ChevronRight className="h-4 w-4 ml-1 opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between text-sm">
            <div className="text-gray-500">
              Showing <span className="font-medium text-gray-900">{filteredData.length > 0 ? (page - 1) * rowsPerPage + 1 : 0}</span> to <span className="font-medium text-gray-900">{Math.min(page * rowsPerPage, filteredData.length)}</span> of <span className="font-medium text-gray-900">{filteredData.length}</span> entries
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 bg-white rounded shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="p-2 border border-gray-300 bg-white rounded shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
