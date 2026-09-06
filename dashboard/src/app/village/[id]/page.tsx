'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import VerdictBadge from '@/components/VerdictBadge';
import SignalCard from '@/components/SignalCard';
import RainfallChart from '@/components/RainfallChart';
import VegetationDropChart from '@/components/VegetationDropChart';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  CircleAlert,
  Satellite,
  Radio,
  CloudRain,
  Building2,
  Loader2,
  Calendar,
  Wheat,
  MapPin,
  Sparkles,
  Bot,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Printer
} from 'lucide-react';

// Helper: determine signal status from the support flags
function getSignalStatus(supportFlag: string | boolean | null | undefined): 'supports' | 'contradicts' | 'unavailable' | 'inconclusive' {
  if (supportFlag === null || supportFlag === undefined || supportFlag === 'NO_DATA') return 'unavailable';
  if (supportFlag === true || supportFlag === 'TRUE' || supportFlag === 'True') return 'supports';
  if (supportFlag === false || supportFlag === 'FALSE' || supportFlag === 'False') return 'contradicts';
  return 'inconclusive';
}

export default function VillageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVillageData() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const { data: record, error: fetchError } = await supabase
          .from('master_eval_dataset')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setData(record);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch claim verification details');
      } finally {
        setLoading(false);
      }
    }
    fetchVillageData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="w-9 h-9 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-700">Loading Claim Verification Matrix...</p>
          <span className="text-xs text-slate-400">Querying Sentinel-1/2 & IMD signals</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <CircleAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Claim Record Not Found</h2>
          <p className="text-slate-500 text-xs mb-6 leading-relaxed">
            {error || 'No matching claim record was found in the evaluated dataset.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Claims Matrix
          </Link>
        </div>
      </div>
    );
  }

  // Derived metrics
  const isMismatch = (data.fraud_label || '').toUpperCase() === 'MISMATCH';
  const isInconclusive = (data.fraud_label || '').toUpperCase() === 'INCONCLUSIVE';
  const isConsistent = (data.fraud_label || '').toUpperCase() === 'CONSISTENT';

  const claimAmt = data.pmfby_claim_amount_inr || 0;
  const sumInsured = data.pmfby_sum_insured_inr || 0;
  const claimRatio = sumInsured > 0 ? ((claimAmt / sumInsured) * 100).toFixed(1) : '0.0';

  // SAR VV delta calculation
  const sarVvDelta = (data.s1_vv_db_pre != null && data.s1_vv_db_post != null)
    ? (data.s1_vv_db_post - data.s1_vv_db_pre)
    : null;

  const formatINR = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return '₹' + Number(val).toLocaleString('en-IN');
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 pb-20">
      {/* Top Breadcrumb Bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>Claims Verification Matrix</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 font-normal">{data.village_name}</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Pilot Season: {data.season || 'Kharif'} {data.year || 2024}
            </span>
            <span className="text-slate-200">|</span>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Audit File
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* =================================================================== */}
        {/* REQUIREMENT 3.3: BIG RED / YELLOW / GREEN BADGES FOR FINAL VERDICT  */}
        {/* =================================================================== */}
        <section
          className={`rounded-2xl p-6 sm:p-8 border shadow-sm transition-all relative overflow-hidden ${
            isMismatch
              ? 'bg-gradient-to-br from-rose-50 via-white to-red-50/40 border-rose-300 ring-4 ring-rose-500/10'
              : isInconclusive
              ? 'bg-gradient-to-br from-amber-50 via-white to-yellow-50/40 border-amber-300 ring-4 ring-amber-500/10'
              : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 border-emerald-300 ring-4 ring-emerald-500/10'
          }`}
        >
          {/* Accent Top Bar */}
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              isMismatch ? 'bg-rose-500' : isInconclusive ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  PMFBY Claim Verification Verdict
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-medium text-slate-600">ID #{data.id}</span>
              </div>

              {/* Village Title */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {data.village_name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {data.taluk}, {data.district} District (Karnataka)
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <Wheat className="w-3.5 h-3.5 text-amber-600" />
                  Claimed Crop: <span className="font-bold text-slate-900">{data.crop_name || 'Rice'}</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Loss Window: {data.loss_window_start || 'Aug 2024'} to {data.loss_window_end || 'Sep 2024'}
                </span>
              </div>
            </div>

            {/* BIG FINAL VERDICT BADGE */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/90 backdrop-blur-xs p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs shrink-0">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Signal Fraud Classification
                </div>
                {/* BIG HIGH-IMPACT VERDICT BADGE */}
                <VerdictBadge verdict={data.fraud_label} size="xl" pulse={isMismatch} />
              </div>

              <div className="hidden sm:block w-px h-14 bg-slate-200" />

              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Audit Confidence
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black tracking-wider uppercase border shadow-2xs ${
                    data.fraud_confidence?.toLowerCase() === 'high'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{data.fraud_confidence || 'LOW'} CONFIDENCE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Financial Bar */}
          <div className="mt-6 pt-5 border-t border-slate-200/70 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase">Claims Filed</span>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {data.pmfby_claims_reported || 1} {data.pmfby_claims_reported === 1 ? 'Claim' : 'Claims'}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase">Claim Amount</span>
              <p className="text-base font-extrabold text-slate-900 mt-0.5">{formatINR(claimAmt)}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase">Sum Insured</span>
              <p className="text-base font-semibold text-slate-700 mt-0.5">{formatINR(sumInsured)}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase">Claim Ratio</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-base font-black ${Number(claimRatio) > 80 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {claimRatio}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium">of sum insured</span>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* REQUIREMENT 3.1: THE AI'S EXPLANATION TEXT AT THE TOP               */}
        {/* =================================================================== */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-600 to-indigo-600" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    AI Verification Analysis & Causal Reasoning
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Groq Llama-3-70B
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Deterministic Rule-Engine Thresholds Phrased by Groq LLM Layer
                </p>
              </div>
            </div>

            {data.llm_is_simulated === false ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Live Model Generated</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Audited Template Fallback</span>
              </div>
            )}
          </div>

          {/* Primary Reason Callout Box */}
          {data.fraud_reason && (
            <div
              className={`p-4 rounded-xl border mb-5 flex items-start gap-3 ${
                isMismatch
                  ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
              }`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${isMismatch ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Primary Causal Finding:
                </h4>
                <p className="text-sm font-semibold leading-snug">
                  {data.fraud_reason}
                </p>
              </div>
            </div>
          )}

          {/* Full Narrative Text */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-normal">
            {data.llm_explanation ? (
              data.llm_explanation
            ) : (
              <span className="text-slate-400 italic">No narrative explanation text generated for this claim.</span>
            )}
          </div>

          {/* Surveyor Recommendation footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-slate-700">Surveyor Recommendation:</span>{' '}
              {isMismatch
                ? 'Flag claim for mandatory on-site physical survey and crop-cutting audit.'
                : 'Check local tehsil rainfall station records before releasing payout.'}
            </span>
            <span className="text-[11px] text-slate-400">
              Deterministic threshold: ΔSAR &lt; -1.5 dB | Rainfall deficit &gt; 20%
            </span>
          </div>
        </section>

        {/* =================================================================== */}
        {/* REQUIREMENT 3.2: SIMPLE, CLEAN CHARTS (RAINFALL DROP & VEGETATION)  */}
        {/* =================================================================== */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Independent Ground Truth Signals
              </h2>
              <p className="text-xs text-slate-500">
                Visualizing empirical vegetation canopy drop and meteorological rainfall drop
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
              2 Independent Signals
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Rainfall Drop & Deficit */}
            <RainfallChart
              actualRainfall={data.actual_rainfall_mm ?? null}
              normalRainfall={data.normal_rainfall_mm ?? null}
              deficitPct={data.rainfall_deficit_pct ?? null}
              supportsDrought={data.rainfall_supports_drought}
            />

            {/* Chart 2: Vegetation Drop (SAR Radar / NDVI) */}
            <VegetationDropChart
              s1FallbackUsed={data.s1_fallback_used}
              s1VvPre={data.s1_vv_db_pre ?? null}
              s1VvPost={data.s1_vv_db_post ?? null}
              ndviReliable={data.ndvi_reliable}
              ndviPre={data.pre_loss_ndvi ?? null}
              ndviPost={data.post_loss_ndvi ?? null}
              cloudPctPre={data.s2_cloud_pct_pre ?? null}
              cloudPctPost={data.s2_cloud_pct_post ?? null}
              supportsLoss={data.ndvi_supports_loss}
            />
          </div>
        </section>

        {/* =================================================================== */}
        {/* MULTI-SIGNAL EVIDENCE 4-GRID                                        */}
        {/* =================================================================== */}
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              4-Signal Evidence Matrix & Safeguard Audit
            </h3>
            <p className="text-xs text-slate-500">
              Cross-referencing optical, radar, gridded weather, and official state gazette data
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Optical NDVI */}
            <SignalCard
              title="Optical NDVI (Sentinel-2)"
              subtitle="Copernicus Data Space"
              icon={Satellite}
              status={getSignalStatus(data.ndvi_supports_loss)}
            >
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Cloud Contamination:</span>
                  <span className="font-bold text-slate-900">
                    {data.s2_cloud_pct_post != null ? `${data.s2_cloud_pct_post.toFixed(0)}%` : '100%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Reliable Flag:</span>
                  <span className={`font-bold ${data.ndvi_reliable ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {data.ndvi_reliable ? 'YES (Clear)' : 'FALSE (Cloudy)'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span>Pre / Post NDVI:</span>
                  <span className="font-bold text-slate-900">
                    {data.pre_loss_ndvi?.toFixed(2) || '0.0'} → {data.post_loss_ndvi?.toFixed(2) || '0.0'}
                  </span>
                </div>
              </div>
            </SignalCard>

            {/* 2. SAR Radar */}
            <SignalCard
              title="SAR Radar (Sentinel-1)"
              subtitle="Cloud-Penetrating Fallback"
              icon={Radio}
              status={
                data.s1_fallback_used === 1
                  ? sarVvDelta !== null && sarVvDelta < -1.5
                    ? 'supports'
                    : 'contradicts'
                  : 'unavailable'
              }
            >
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Fallback Status:</span>
                  <span className="font-bold text-indigo-600">
                    {data.s1_fallback_used === 1 ? 'Active (SAR VV)' : 'Not Required'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>VV Backscatter Δ:</span>
                  <span className="font-bold text-slate-900">
                    {sarVvDelta !== null ? `${sarVvDelta > 0 ? '+' : ''}${sarVvDelta.toFixed(2)} dB` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span>Loss Threshold:</span>
                  <span className="font-bold text-slate-600">&lt; -1.5 dB drop</span>
                </div>
              </div>
            </SignalCard>

            {/* 3. Open-Meteo & IMD Rainfall */}
            <SignalCard
              title="Weather Precipitation"
              subtitle="Open-Meteo & IMD Gridded"
              icon={CloudRain}
              status={getSignalStatus(data.rainfall_supports_drought)}
            >
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Observed Rainfall:</span>
                  <span className="font-bold text-slate-900">{data.actual_rainfall_mm?.toFixed(1) || '0'} mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Normal Rainfall:</span>
                  <span className="font-bold text-slate-900">{data.normal_rainfall_mm?.toFixed(1) || '0'} mm</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span>Drought Deficit:</span>
                  <span className={`font-bold ${data.rainfall_deficit_pct > 20 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {data.rainfall_deficit_pct?.toFixed(1) || '0.0'}%
                  </span>
                </div>
              </div>
            </SignalCard>

            {/* 4. Official Gazette Safeguard */}
            <SignalCard
              title="Official Gazette Records"
              subtitle="KSDMA Drought & DES Yield"
              icon={Building2}
              status="unavailable"
            >
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>KSDMA Declaration:</span>
                  <span className="font-semibold text-slate-500">NO_DATA</span>
                </div>
                <div className="flex justify-between">
                  <span>DES Yield Baseline:</span>
                  <span className="font-semibold text-slate-500">NO_DATA</span>
                </div>
                <div className="pt-1 border-t border-slate-100 text-[11px] text-amber-800 leading-snug">
                  Safeguard active: Unverified state baselines omitted to prevent hallucinated verdicts.
                </div>
              </div>
            </SignalCard>
          </div>
        </section>

      </main>
    </div>
  );
}
