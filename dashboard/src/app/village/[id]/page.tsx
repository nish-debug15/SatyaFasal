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
  Satellite,
  Radio,
  CloudRain,
  Building2,
  Loader2,
  Sparkles,
  Bot,
  AlertTriangle,
  CheckCircle2,
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
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3 p-8 bg-surface rounded border border-rule">
          <Loader2 className="w-8 h-8 animate-spin text-ink-secondary" />
          <p className="text-sm font-medium text-ink">Loading claim verification data…</p>
          <span className="text-xs text-ink-secondary">Querying Sentinel-1/2 and IMD signals</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-4">
        <div className="max-w-md w-full bg-surface p-8 rounded border border-rule text-center">
          <h2 className="text-lg font-semibold text-ink mb-2">Claim record not found</h2>
          <p className="text-ink-secondary text-xs mb-6 leading-relaxed">
            {error || 'No matching claim record was found in the evaluated dataset.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-ink text-white text-xs font-medium rounded hover:bg-ink/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to claims register
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

  const verdictBorderColor = isMismatch
    ? 'border-flag-red'
    : isInconclusive
    ? 'border-flag-amber'
    : 'border-flag-green';

  const verdictAccentColor = isMismatch
    ? 'bg-flag-red'
    : isInconclusive
    ? 'bg-flag-amber'
    : 'bg-flag-green';

  return (
    <div className="min-h-screen bg-paper text-ink pb-20">
      {/* Breadcrumb bar */}
      <div className="bg-surface border-b border-rule sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Claims register</span>
            <span className="text-ink-disabled mx-1">/</span>
            <span className="text-ink">{data.village_name}</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-ink-secondary">
              {data.season || 'Kharif'} {data.year || 2024}
            </span>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-secondary hover:text-ink bg-paper border border-rule px-2.5 py-1 rounded transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print audit file
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Verdict Header ── */}
        <section
          className={`rounded bg-surface p-6 sm:p-8 border ${verdictBorderColor} border-l-[3px]`}
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-secondary">
                PMFBY claim verification verdict
                <span className="text-ink-disabled mx-1.5">—</span>
                <span className="text-ink-secondary">ID #{data.id}</span>
              </p>

              {/* Village title */}
              <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                {data.village_name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
                <span>
                  {data.taluk}, {data.district} District (Karnataka)
                </span>
                <span>
                  Crop: <span className="font-medium text-ink">{data.crop_name || 'Rice'}</span>
                </span>
                <span>
                  Loss window: {data.loss_window_start || 'Aug 2024'} to {data.loss_window_end || 'Sep 2024'}
                </span>
              </div>
            </div>

            {/* Verdict + confidence */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-paper p-4 rounded border border-rule shrink-0">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-ink-secondary">
                  Signal classification
                </p>
                <VerdictBadge verdict={data.fraud_label} size="lg" />
              </div>

              <div className="hidden sm:block w-px h-12 bg-rule" />

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-ink-secondary">
                  Audit confidence
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 font-data text-sm font-semibold px-2.5 py-1 rounded-sm border bg-white ${
                    data.fraud_confidence?.toLowerCase() === 'high'
                      ? 'text-flag-red border-flag-red/40'
                      : 'text-flag-amber border-flag-amber/40'
                  }`}
                >
                  {data.fraud_confidence || 'Low'} confidence
                </span>
              </div>
            </div>
          </div>

          {/* Financial summary row */}
          <div className="mt-6 pt-5 border-t border-rule/50 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[11px] font-medium text-ink-secondary">Claims filed</span>
              <p className="font-data text-base font-semibold text-ink mt-0.5">
                {data.pmfby_claims_reported || 1}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-ink-secondary">Claim amount</span>
              <p className="font-data text-base font-bold text-ink mt-0.5">{formatINR(claimAmt)}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-ink-secondary">Sum insured</span>
              <p className="font-data text-base font-medium text-ink mt-0.5">{formatINR(sumInsured)}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-ink-secondary">Claim ratio</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`font-data text-base font-bold ${Number(claimRatio) > 80 ? 'text-flag-red' : 'text-ink'}`}>
                  {claimRatio}%
                </span>
                <span className="text-[10px] text-ink-disabled">of sum insured</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Verification Analysis ── */}
        <section className="bg-surface rounded p-6 sm:p-7 border border-rule border-l-[3px] border-l-ink-secondary">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-ink-secondary" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">
                    AI verification analysis
                  </h2>
                  <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-px rounded-sm border border-rule text-ink-secondary bg-white">
                    Groq Llama-3-70B
                  </span>
                </div>
                <p className="text-xs text-ink-secondary">
                  Deterministic rule-engine thresholds phrased by Groq LLM layer
                </p>
              </div>
            </div>

            {data.llm_is_simulated === false ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-flag-green/40 text-flag-green text-xs font-medium bg-white">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Live model generated</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-rule text-ink-secondary text-xs font-medium bg-white">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Audited template fallback</span>
              </div>
            )}
          </div>

          {/* Primary finding callout */}
          {data.fraud_reason && (
            <div
              className={`p-4 rounded border mb-5 flex items-start gap-3 ${
                isMismatch
                  ? 'border-flag-red/30 text-flag-red'
                  : 'border-flag-amber/30 text-flag-amber'
              }`}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold">
                  Primary causal finding
                </h4>
                <p className="text-sm font-medium text-ink leading-snug">
                  {data.fraud_reason}
                </p>
              </div>
            </div>
          )}

          {/* Full narrative */}
          <div className="bg-paper rounded p-5 border border-rule/50 text-ink text-sm leading-relaxed whitespace-pre-wrap">
            {data.llm_explanation ? (
              data.llm_explanation
            ) : (
              <span className="text-ink-disabled italic">No narrative explanation text generated for this claim.</span>
            )}
          </div>

          {/* Surveyor recommendation */}
          <div className="mt-4 pt-3 border-t border-rule/50 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-ink-secondary" />
              <span className="font-medium text-ink">Surveyor recommendation:</span>{' '}
              {isMismatch
                ? 'Flag claim for mandatory on-site physical survey and crop-cutting audit.'
                : 'Check local tehsil rainfall station records before releasing payout.'}
            </span>
            <span className="text-[11px] text-ink-disabled">
              Deterministic threshold: ΔSAR &lt; −1.5 dB | Rainfall deficit &gt; 20%
            </span>
          </div>
        </section>

        {/* ── Charts: Ground Truth Signals ── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Independent ground truth signals
            </h2>
            <p className="text-xs text-ink-secondary">
              Empirical vegetation canopy drop and meteorological rainfall deficit
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RainfallChart
              actualRainfall={data.actual_rainfall_mm ?? null}
              normalRainfall={data.normal_rainfall_mm ?? null}
              deficitPct={data.rainfall_deficit_pct ?? null}
              supportsDrought={data.rainfall_supports_drought}
            />
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

        {/* ── 4-Signal Evidence Matrix (PRIMARY CONTENT) ── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Evidence matrix
            </h2>
            <p className="text-xs text-ink-secondary">
              Cross-referencing optical, radar, gridded weather, and official state gazette data
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* 1. Optical NDVI */}
            <SignalCard
              title="Optical NDVI (Sentinel-2)"
              subtitle="Copernicus Data Space"
              icon={Satellite}
              status={getSignalStatus(data.ndvi_supports_loss)}
            >
              <div className="space-y-1.5 text-xs text-ink-secondary">
                <div className="flex justify-between">
                  <span>Cloud contamination</span>
                  <span className="font-data font-medium text-ink">
                    {data.s2_cloud_pct_post != null ? `${data.s2_cloud_pct_post.toFixed(0)}%` : '100%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Reliable flag</span>
                  <span className={`font-medium ${data.ndvi_reliable ? 'text-flag-green' : 'text-flag-amber'}`}>
                    {data.ndvi_reliable ? 'Yes (clear)' : 'No (cloudy)'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-rule/50">
                  <span>Pre / post NDVI</span>
                  <span className="font-data font-medium text-ink">
                    {data.pre_loss_ndvi?.toFixed(2) || '0.0'} → {data.post_loss_ndvi?.toFixed(2) || '0.0'}
                  </span>
                </div>
              </div>
            </SignalCard>

            {/* 2. SAR Radar */}
            <SignalCard
              title="SAR Radar (Sentinel-1)"
              subtitle="Cloud-penetrating fallback"
              icon={Radio}
              status={
                data.s1_fallback_used === 1
                  ? sarVvDelta !== null && sarVvDelta < -1.5
                    ? 'supports'
                    : 'contradicts'
                  : 'unavailable'
              }
            >
              <div className="space-y-1.5 text-xs text-ink-secondary">
                <div className="flex justify-between">
                  <span>Fallback status</span>
                  <span className="font-medium text-ink">
                    {data.s1_fallback_used === 1 ? 'Active (SAR VV)' : 'Not required'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>VV backscatter Δ</span>
                  <span className="font-data font-medium text-ink">
                    {sarVvDelta !== null ? `${sarVvDelta > 0 ? '+' : ''}${sarVvDelta.toFixed(2)} dB` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-rule/50">
                  <span>Loss threshold</span>
                  <span className="font-data font-medium text-ink-secondary">&lt; −1.5 dB drop</span>
                </div>
              </div>
            </SignalCard>

            {/* 3. Weather Precipitation */}
            <SignalCard
              title="Weather precipitation"
              subtitle="Open-Meteo and IMD gridded"
              icon={CloudRain}
              status={getSignalStatus(data.rainfall_supports_drought)}
            >
              <div className="space-y-1.5 text-xs text-ink-secondary">
                <div className="flex justify-between">
                  <span>Observed rainfall</span>
                  <span className="font-data font-medium text-ink">{data.actual_rainfall_mm?.toFixed(1) || '0'} mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Normal rainfall</span>
                  <span className="font-data font-medium text-ink">{data.normal_rainfall_mm?.toFixed(1) || '0'} mm</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-rule/50">
                  <span>Drought deficit</span>
                  <span className={`font-data font-medium ${data.rainfall_deficit_pct > 20 ? 'text-flag-amber' : 'text-ink'}`}>
                    {data.rainfall_deficit_pct?.toFixed(1) || '0.0'}%
                  </span>
                </div>
              </div>
            </SignalCard>

            {/* 4. Official Gazette */}
            <SignalCard
              title="Official gazette records"
              subtitle="KSDMA drought and DES yield"
              icon={Building2}
              status="unavailable"
            >
              <div className="space-y-1.5 text-xs text-ink-secondary">
                <div className="flex justify-between">
                  <span>KSDMA declaration</span>
                  <span className="font-medium text-ink-disabled">No data</span>
                </div>
                <div className="flex justify-between">
                  <span>DES yield baseline</span>
                  <span className="font-medium text-ink-disabled">No data</span>
                </div>
                <div className="pt-1 border-t border-rule/50 text-[11px] text-flag-amber leading-snug">
                  Safeguard active: unverified state baselines omitted to prevent hallucinated verdicts.
                </div>
              </div>
            </SignalCard>
          </div>
        </section>

      </main>
    </div>
  );
}
