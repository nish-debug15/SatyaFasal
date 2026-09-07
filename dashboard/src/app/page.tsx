'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StatsCards from '@/components/StatsCards';
import VerdictBadge from '@/components/VerdictBadge';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  Download,
  Filter,
  ArrowUpDown,
  MapPin,
  Wheat,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fraudFilter, setFraudFilter] = useState('ALL');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'amount_desc' | 'amount_asc' | 'village_asc' | 'confidence'>('amount_desc');

  // Pagination
  const [page, setPage] = useState(1);
  const rowsPerPage = 15;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: dbData, error: dbError } = await supabase
        .from('master_eval_dataset')
        .select(`
          id, village_name, district, taluk, crop_name, season, year,
          multimodal_verdict, fraud_label, fraud_confidence, fraud_reason,
          pmfby_claim_amount_inr, pmfby_sum_insured_inr,
          rainfall_deficit_pct, s1_fallback_used, ndvi_reliable
        `)
        .order('id', { ascending: true });

      if (dbError) throw dbError;
      setData(dbData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch claim verification records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Distinct districts for dropdown filter
  const districts = useMemo(() => {
    const list = Array.from(new Set(data.map(r => r.district).filter(Boolean)));
    return list.sort();
  }, [data]);

  // Filtered & Sorted Dataset
  const filteredData = useMemo(() => {
    let result = data.filter(row => {
      const q = debouncedSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (row.village_name && row.village_name.toLowerCase().includes(q)) ||
        (row.district && row.district.toLowerCase().includes(q)) ||
        (row.taluk && row.taluk.toLowerCase().includes(q)) ||
        (row.crop_name && row.crop_name.toLowerCase().includes(q));

      const matchesFraud =
        fraudFilter === 'ALL' ||
        (row.fraud_label && row.fraud_label.toUpperCase() === fraudFilter.toUpperCase());

      const matchesDistrict =
        districtFilter === 'ALL' ||
        (row.district && row.district.toLowerCase() === districtFilter.toLowerCase());

      return matchesSearch && matchesFraud && matchesDistrict;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'amount_desc') {
        return (b.pmfby_claim_amount_inr || 0) - (a.pmfby_claim_amount_inr || 0);
      }
      if (sortBy === 'amount_asc') {
        return (a.pmfby_claim_amount_inr || 0) - (b.pmfby_claim_amount_inr || 0);
      }
      if (sortBy === 'village_asc') {
        return (a.village_name || '').localeCompare(b.village_name || '');
      }
      if (sortBy === 'confidence') {
        const rank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const rankA = rank[a.fraud_confidence?.toUpperCase() || ''] || 0;
        const rankB = rank[b.fraud_confidence?.toUpperCase() || ''] || 0;
        return rankB - rankA;
      }
      return 0;
    });

    return result;
  }, [data, debouncedSearch, fraudFilter, districtFilter, sortBy]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, fraudFilter, districtFilter, sortBy]);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return '₹' + Number(val).toLocaleString('en-IN');
  };

  // CSV Export
  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    const headers = [
      'ID',
      'Village Name',
      'District',
      'Taluk',
      'Crop',
      'Season',
      'Fraud Signal Label',
      'Confidence',
      'Multimodal Verdict',
      'Claim Amount (INR)',
      'Sum Insured (INR)',
      'Radar Fallback Used'
    ];
    const rows = filteredData.map(r => [
      r.id,
      `"${r.village_name || ''}"`,
      `"${r.district || ''}"`,
      `"${r.taluk || ''}"`,
      `"${r.crop_name || 'Rice'}"`,
      `"${r.season || 'Kharif'} ${r.year || 2024}"`,
      `"${r.fraud_label || ''}"`,
      `"${r.fraud_confidence || ''}"`,
      `"${r.multimodal_verdict || ''}"`,
      r.pmfby_claim_amount_inr || 0,
      r.pmfby_sum_insured_inr || 0,
      r.s1_fallback_used ? 'YES' : 'NO'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `satyafasal_claims_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-700">Loading PMFBY Claims Verification Matrix...</p>
          <span className="text-xs text-slate-400">Fetching 101 Karnataka Pilot Villages</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-rose-200 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <CircleAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Database Connection Error</h2>
          <p className="mt-2 text-xs text-slate-500">{error}</p>
          <button
            onClick={fetchData}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors text-sm shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const mismatchCount = data.filter(r => (r.fraud_label || '').toUpperCase() === 'MISMATCH').length;
  const inconclusiveCount = data.filter(r => (r.fraud_label || '').toUpperCase() === 'INCONCLUSIVE').length;

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 pb-20">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">SatyaFasal</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    SIH 2026
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Supabase Live
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Multimodal Satellite (SAR + NDVI) & Weather Verification Layer for PMFBY Claims • Karnataka Pilot
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={exportToCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-xs"
                title="Download filtered claims to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* KPI Overview Cards */}
        <StatsCards
          data={data}
          activeFilter={fraudFilter}
          onFilterSelect={(filter) => setFraudFilter(filter)}
        />

        {/* Claims Table Container */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          {/* Table Controls & Filters Toolbar */}
          <div className="p-5 border-b border-slate-200/80 bg-slate-50/50 space-y-4">
            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFraudFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    fraudFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All Claims ({data.length})
                </button>
                <button
                  onClick={() => setFraudFilter('MISMATCH')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                    fraudFilter === 'MISMATCH'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs shadow-rose-500/20'
                      : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Flagged (Mismatch) ({mismatchCount})
                </button>
                <button
                  onClick={() => setFraudFilter('INCONCLUSIVE')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    fraudFilter === 'INCONCLUSIVE'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs shadow-amber-500/20'
                      : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  Inconclusive Safeguard ({inconclusiveCount})
                </button>
              </div>

              <div className="text-xs font-semibold text-slate-500">
                Showing {filteredData.length} of {data.length} villages
              </div>
            </div>

            {/* Search, District Filter, and Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search village, district, taluk, or crop..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-xs font-medium placeholder:text-slate-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* District Filter */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 text-[11px]">District:</span>
                  <select
                    className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer text-xs"
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                  >
                    <option value="ALL">All Districts</option>
                    {districts.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 text-[11px]">Sort:</span>
                  <select
                    className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer text-xs"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="amount_desc">Claim Amount (High → Low)</option>
                    <option value="amount_asc">Claim Amount (Low → High)</option>
                    <option value="confidence">Confidence (High First)</option>
                    <option value="village_asc">Village Name (A → Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">Village & Location</th>
                  <th className="px-5 py-3.5">Crop & Season</th>
                  <th className="px-5 py-3.5">Signal Label</th>
                  <th className="px-5 py-3.5">Pipeline Verdict</th>
                  <th className="px-5 py-3.5">Confidence</th>
                  <th className="px-5 py-3.5">Claim Financials</th>
                  <th className="px-5 py-3.5 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center max-w-xs mx-auto">
                        <Search className="h-8 w-8 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700 text-sm">No matching claims found</p>
                        <p className="text-xs text-slate-400 mt-1">Try loosening your search query or reset filters.</p>
                        <button
                          onClick={() => {
                            setSearch('');
                            setFraudFilter('ALL');
                            setDistrictFilter('ALL');
                          }}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, index) => {
                    const rowNumber = (page - 1) * rowsPerPage + index + 1;
                    const isMismatch = (row.fraud_label || '').toUpperCase() === 'MISMATCH';
                    const claimAmt = row.pmfby_claim_amount_inr || 0;
                    const sumInsured = row.pmfby_sum_insured_inr || 1;
                    const ratio = Math.min(100, ((claimAmt / sumInsured) * 100));

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors duration-150 group ${
                          isMismatch
                            ? 'bg-rose-50/30 hover:bg-rose-50/60 border-l-4 border-l-rose-500'
                            : 'hover:bg-slate-50/80 even:bg-slate-50/30 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* 1. Row index */}
                        <td className="px-5 py-3.5 text-slate-400 font-medium">{rowNumber}</td>

                        {/* 2. Village & District */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{row.village_name || '-'}</div>
                              <div className="text-[11px] text-slate-500">
                                {row.taluk}, <span className="font-medium text-slate-600">{row.district}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Crop & Season */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Wheat className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800">{row.crop_name || 'Rice'}</div>
                              <div className="text-[10px] text-slate-400">
                                {row.season || 'Kharif'} {row.year || '2024'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 4. Signal Label */}
                        <td className="px-5 py-3.5">
                          <VerdictBadge verdict={row.fraud_label} size="sm" />
                        </td>

                        {/* 5. Pipeline Verdict */}
                        <td className="px-5 py-3.5">
                          <VerdictBadge verdict={row.multimodal_verdict} size="sm" />
                        </td>

                        {/* 6. Confidence */}
                        <td className="px-5 py-3.5">
                          {row.fraud_confidence ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border uppercase ${
                                row.fraud_confidence.toLowerCase() === 'high'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              {row.fraud_confidence}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* 7. Claim Financials & Mini Ratio Bar */}
                        <td className="px-5 py-3.5">
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {formatCurrency(row.pmfby_claim_amount_inr)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    ratio > 80 ? 'bg-rose-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${ratio}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {ratio.toFixed(0)}% of SI
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 8. Inspect Detail Action */}
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/village/${row.id}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all ${
                              isMismatch
                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs shadow-rose-500/20'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            }`}
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500">
              Showing{' '}
              <span className="font-bold text-slate-800">
                {filteredData.length > 0 ? (page - 1) * rowsPerPage + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-bold text-slate-800">
                {Math.min(page * rowsPerPage, filteredData.length)}
              </span>{' '}
              of <span className="font-bold text-slate-800">{filteredData.length}</span> claims
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs font-medium"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <span className="px-3 py-1 text-slate-600 font-semibold">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs font-medium"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
