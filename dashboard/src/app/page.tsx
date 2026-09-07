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
      <div className="flex h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3 p-8 bg-surface rounded border border-rule">
          <Loader2 className="h-8 w-8 animate-spin text-ink-secondary" />
          <p className="text-sm font-medium text-ink">Loading PMFBY claims register...</p>
          <span className="text-xs text-ink-disabled">Fetching 101 Karnataka pilot villages</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-paper min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full bg-surface rounded border border-rule p-6 text-center">
          <div className="w-10 h-10 rounded bg-white border border-rule text-flag-red flex items-center justify-center mx-auto mb-3">
            <CircleAlert className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-ink">Database connection error</h2>
          <p className="mt-2 text-xs text-ink-secondary">{error}</p>
          <button
            onClick={fetchData}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-ink hover:bg-ink/90 text-white font-medium rounded text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  const mismatchCount = data.filter(r => (r.fraud_label || '').toUpperCase() === 'MISMATCH').length;
  const inconclusiveCount = data.filter(r => (r.fraud_label || '').toUpperCase() === 'INCONCLUSIVE').length;

  return (
    <div className="min-h-screen bg-paper text-ink pb-20">
      {/* Top Header */}
      <header className="bg-surface border-b border-rule sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-white border border-rule flex items-center justify-center text-ink-secondary">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-ink tracking-tight">SatyaFasal</h1>
                </div>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Multimodal satellite & weather verification layer for PMFBY claims
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportToCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink bg-white hover:bg-paper border border-rule rounded transition-colors"
                title="Download filtered claims to CSV"
              >
                <Download className="w-3.5 h-3.5 text-ink-secondary" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* KPI Overview Cards */}
        <StatsCards
          data={data}
          activeFilter={fraudFilter}
          onFilterSelect={(filter) => setFraudFilter(filter)}
        />

        {/* Claims Table Container */}
        <div className="bg-surface rounded border border-rule overflow-hidden">
          {/* Table Controls & Filters Toolbar */}
          <div className="p-4 border-b border-rule/50 bg-paper/50 space-y-4">
            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFraudFilter('ALL')}
                  className={`px-3 py-1 rounded-sm text-xs font-medium transition-all border ${
                    fraudFilter === 'ALL'
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-ink border-rule hover:bg-paper'
                  }`}
                >
                  All claims ({data.length})
                </button>
                <button
                  onClick={() => setFraudFilter('MISMATCH')}
                  className={`px-3 py-1 rounded-sm text-xs font-medium transition-all border flex items-center gap-1.5 ${
                    fraudFilter === 'MISMATCH'
                      ? 'bg-flag-red text-white border-flag-red'
                      : 'bg-white text-flag-red border-rule hover:border-flag-red/50'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Flagged mismatch ({mismatchCount})
                </button>
                <button
                  onClick={() => setFraudFilter('INCONCLUSIVE')}
                  className={`px-3 py-1 rounded-sm text-xs font-medium transition-all border ${
                    fraudFilter === 'INCONCLUSIVE'
                      ? 'bg-flag-amber text-white border-flag-amber'
                      : 'bg-white text-flag-amber border-rule hover:border-flag-amber/50'
                  }`}
                >
                  Inconclusive safeguard ({inconclusiveCount})
                </button>
              </div>

              <div className="text-xs font-medium text-ink-secondary">
                Showing {filteredData.length} of {data.length} villages
              </div>
            </div>

            {/* Search, District Filter, and Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-disabled" />
                <input
                  type="text"
                  placeholder="Search village, district, taluk..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-rule rounded focus:ring-1 focus:ring-ink focus:border-ink outline-none transition-all text-xs font-medium placeholder:text-ink-disabled text-ink"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* District Filter */}
                <div className="flex items-center gap-1.5 bg-white border border-rule rounded px-2.5 py-1 text-xs">
                  <Filter className="w-3.5 h-3.5 text-ink-secondary" />
                  <span className="text-ink-secondary text-[11px]">District:</span>
                  <select
                    className="bg-transparent font-medium text-ink outline-none cursor-pointer text-xs"
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                  >
                    <option value="ALL">All districts</option>
                    {districts.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div className="flex items-center gap-1.5 bg-white border border-rule rounded px-2.5 py-1 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-ink-secondary" />
                  <span className="text-ink-secondary text-[11px]">Sort:</span>
                  <select
                    className="bg-transparent font-medium text-ink outline-none cursor-pointer text-xs"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="amount_desc">Claim amount (high → low)</option>
                    <option value="amount_asc">Claim amount (low → high)</option>
                    <option value="confidence">Confidence (high first)</option>
                    <option value="village_asc">Village name (A → Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-paper border-b border-rule text-ink-secondary font-medium text-[11px]">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Village & location</th>
                  <th className="px-4 py-3 font-medium">Crop & season</th>
                  <th className="px-4 py-3 font-medium">Signal label</th>
                  <th className="px-4 py-3 font-medium">Pipeline verdict</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Claim financials</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/50">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-ink-disabled">
                      <div className="flex flex-col items-center justify-center max-w-xs mx-auto">
                        <Search className="h-6 w-6 text-rule mb-2" />
                        <p className="font-medium text-ink text-sm">No matching claims found</p>
                        <button
                          onClick={() => {
                            setSearch('');
                            setFraudFilter('ALL');
                            setDistrictFilter('ALL');
                          }}
                          className="mt-3 px-3 py-1 text-xs font-medium text-ink bg-white border border-rule rounded hover:bg-paper transition-colors"
                        >
                          Clear filters
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
                        className={`transition-colors duration-150 group bg-white ${
                          isMismatch
                            ? 'hover:bg-flag-red/5 border-l-[3px] border-l-flag-red'
                            : 'hover:bg-paper border-l-[3px] border-l-transparent'
                        }`}
                      >
                        {/* 1. Row index */}
                        <td className="px-4 py-3 text-ink-disabled font-data">{rowNumber}</td>

                        {/* 2. Village & District */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-ink-disabled shrink-0" />
                            <div>
                              <div className="font-semibold text-ink text-xs">{row.village_name || '-'}</div>
                              <div className="text-[11px] text-ink-secondary">
                                {row.taluk}, {row.district}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Crop & Season */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Wheat className="w-3.5 h-3.5 text-ink-disabled shrink-0" />
                            <div>
                              <div className="font-medium text-ink text-xs">{row.crop_name || 'Rice'}</div>
                              <div className="text-[11px] text-ink-secondary">
                                {row.season || 'Kharif'} {row.year || '2024'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 4. Signal Label */}
                        <td className="px-4 py-3">
                          <VerdictBadge verdict={row.fraud_label} size="md" />
                        </td>

                        {/* 5. Pipeline Verdict */}
                        <td className="px-4 py-3">
                          <VerdictBadge verdict={row.multimodal_verdict} size="sm" />
                        </td>

                        {/* 6. Confidence */}
                        <td className="px-4 py-3">
                          {row.fraud_confidence ? (
                            <span
                              className={`px-1.5 py-px rounded-sm text-[11px] font-medium border bg-white ${
                                row.fraud_confidence.toLowerCase() === 'high'
                                  ? 'text-flag-red border-flag-red/40'
                                  : 'text-flag-amber border-flag-amber/40'
                              }`}
                            >
                              {row.fraud_confidence.charAt(0).toUpperCase() + row.fraud_confidence.slice(1).toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-ink-disabled">-</span>
                          )}
                        </td>

                        {/* 7. Claim Financials */}
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium font-data text-ink text-[13px]">
                              {formatCurrency(row.pmfby_claim_amount_inr)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-ink-secondary font-data">
                                {ratio.toFixed(0)}% of SI
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 8. Inspect Detail Action */}
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/village/${row.id}`}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                              isMismatch
                                ? 'bg-flag-red hover:bg-flag-red/90 text-white'
                                : 'bg-white hover:bg-paper border border-rule text-ink'
                            }`}
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
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
          <div className="px-4 py-3 border-t border-rule/50 bg-paper/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-ink-secondary">
              Showing{' '}
              <span className="font-medium font-data text-ink">
                {filteredData.length > 0 ? (page - 1) * rowsPerPage + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-medium font-data text-ink">
                {Math.min(page * rowsPerPage, filteredData.length)}
              </span>{' '}
              of <span className="font-medium font-data text-ink">{filteredData.length}</span> claims
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-2.5 py-1 border border-rule bg-white rounded text-ink hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <span className="px-2 py-1 text-ink-secondary font-medium font-data">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 border border-rule bg-white rounded text-ink hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
