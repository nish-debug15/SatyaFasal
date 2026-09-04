'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import VerdictBadge from '@/components/VerdictBadge';
import SignalCard from '@/components/SignalCard';
import RainfallChart from '@/components/RainfallChart';
import { 
  ArrowLeft, ShieldCheck, ShieldAlert, 
  Satellite, Radio, CloudRain, Building2,
  Loader2
} from 'lucide-react';

// Helper: determine signal status from the support flags
function getSignalStatus(supportFlag: string | null | undefined): 'supports' | 'contradicts' | 'unavailable' | 'inconclusive' {
  if (!supportFlag || supportFlag === 'NO_DATA') return 'unavailable';
  if (supportFlag === 'TRUE' || supportFlag === 'True') return 'supports';
  if (supportFlag === 'FALSE' || supportFlag === 'False') return 'contradicts';
  return 'inconclusive';
}

export default function VillageDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVillageData() {
      if (!id) return;
      try {
        setLoading(true);
        const { data: record, error: fetchError } = await supabase
          .from('master_eval_dataset')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setData(record);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch village data');
      } finally {
        setLoading(false);
      }
    }
    fetchVillageData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">Loading village details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Village Not Found</h2>
          <p className="text-gray-500 mb-6">{error || "We couldn't find the details for this village."}</p>
          <Link 
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Derived calculations using actual Supabase column names
  const claimRatio = data.pmfby_sum_insured_inr && data.pmfby_claim_amount_inr 
    ? ((data.pmfby_claim_amount_inr / data.pmfby_sum_insured_inr) * 100).toFixed(1)
    : '0.0';

  // Compute SAR VV delta from pre/post values
  const sarVvDelta = (data.s1_vv_db_pre != null && data.s1_vv_db_post != null)
    ? (data.s1_vv_db_post - data.s1_vv_db_pre)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-16">
      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link 
          href="/" 
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Hero Header Section */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                {data.village_name}
              </h1>
              <p className="text-gray-500 text-lg">
                {data.taluk}, {data.district} District • {data.season} {data.year}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pipeline Verdict</span>
                <VerdictBadge verdict={data.multimodal_verdict} size="lg" />
              </div>
              <div className="hidden sm:block w-px h-12 bg-gray-200"></div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Signal Label</span>
                <VerdictBadge verdict={data.fraud_label} size="lg" />
              </div>
              <div className="hidden sm:block w-px h-12 bg-gray-200"></div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confidence</span>
                <span className={`px-3 py-1.5 rounded-full text-sm font-semibold inline-flex items-center border ${
                  data.fraud_confidence === 'HIGH' 
                    ? 'bg-red-500 text-white border-red-600' 
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {data.fraud_confidence || 'LOW'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Ground Truth Signals Grid */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Ground Truth Signals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* NDVI Satellite */}
                <SignalCard 
                  title="NDVI Satellite (Optical)"
                  icon={Satellite}
                  status={getSignalStatus(data.ndvi_supports_loss)}
                >
                  <div className="mt-2 space-y-1 text-sm">
                    {data.ndvi_reliable === false ? (
                      <p className="text-amber-700 font-medium">
                        ⚠ Cloud Contaminated (Post: {data.s2_cloud_pct_post?.toFixed(1) || '?'}%)
                      </p>
                    ) : (
                      <p className="text-gray-700">Reliable — low cloud cover.</p>
                    )}
                    {data.ndvi_change != null && (
                      <p className="text-gray-600">NDVI Change: <span className="font-semibold text-gray-900">{data.ndvi_change.toFixed(4)}</span></p>
                    )}
                    <p className="text-gray-600">Supports Loss: <span className="font-semibold text-gray-900">{data.ndvi_supports_loss || 'NO_DATA'}</span></p>
                  </div>
                </SignalCard>

                {/* SAR Radar */}
                <SignalCard 
                  title="SAR Radar (Sentinel-1)"
                  icon={Radio}
                  status={data.s1_fallback_used === 1 
                    ? (sarVvDelta !== null && sarVvDelta < -1.5 ? 'supports' : 'contradicts')
                    : 'unavailable'
                  }
                >
                  <div className="mt-2 space-y-1 text-sm">
                    {data.s1_fallback_used === 1 ? (
                      <>
                        <p className="text-amber-700 font-medium">☁ Used as cloud-penetrating fallback</p>
                        {sarVvDelta !== null && (
                          <p className="text-gray-600">VV Delta: <span className="font-semibold text-gray-900">{sarVvDelta.toFixed(2)} dB</span></p>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 italic">Not needed — NDVI was reliable</p>
                    )}
                  </div>
                </SignalCard>

                {/* Rainfall */}
                <SignalCard 
                  title="Rainfall (Open-Meteo)"
                  icon={CloudRain}
                  status={getSignalStatus(data.rainfall_supports_drought)}
                >
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual:</span>
                      <span className="font-semibold text-gray-900">{data.actual_rainfall_mm?.toFixed(1) || 'N/A'} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Normal:</span>
                      <span className="font-semibold text-gray-900">{data.normal_rainfall_mm?.toFixed(1) || 'N/A'} mm</span>
                    </div>
                    <div className="flex justify-between mt-1 pt-1 border-t border-gray-100">
                      <span className="text-gray-600">Deficit:</span>
                      <span className={`font-semibold ${data.rainfall_deficit_pct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {data.rainfall_deficit_pct?.toFixed(1) || '0.0'}%
                      </span>
                    </div>
                  </div>
                </SignalCard>

                {/* Official Records (KSDMA + DES) */}
                <SignalCard 
                  title="Official Records"
                  icon={Building2}
                  status={
                    data.ksdma_supports_loss === 'NO_DATA' && data.yield_supports_loss === 'NO_DATA'
                      ? 'unavailable'
                      : getSignalStatus(data.ksdma_supports_loss)
                  }
                >
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">KSDMA Drought:</span>
                      <span className="font-semibold text-gray-900">
                        {data.ksdma_officially_declared_drought === 1 ? 'Declared' : data.ksdma_officially_declared_drought === 0 ? 'Not Declared' : 'No Data'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">DES Yield Loss:</span>
                      <span className="font-semibold text-gray-900">
                        {data.des_yield_loss_pct != null ? `${data.des_yield_loss_pct.toFixed(1)}%` : 'No Data'}
                      </span>
                    </div>
                  </div>
                </SignalCard>
              </div>
            </section>

            {/* AI Explanation Section */}
            <section className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-gray-900">AI Analysis & Reasoning</h2>
                {data.llm_is_simulated === false ? (
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    AI Verified
                  </div>
                ) : (
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                    Simulated
                  </div>
                )}
              </div>

              <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 mb-6 whitespace-pre-wrap">
                {data.llm_explanation || 'No explanation available.'}
              </div>

              {data.fraud_reason && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Primary Reason for Label</h4>
                  <p className="text-sm text-gray-800 font-medium">{data.fraud_reason}</p>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            
            {/* Claim Details Card */}
            <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Claim Financials</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Claims Reported</p>
                  <p className="text-2xl font-bold text-gray-900">{data.pmfby_claims_reported?.toLocaleString() || 0}</p>
                </div>
                
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500 font-medium">Sum Insured</p>
                  <p className="text-xl font-semibold text-gray-900">
                    ₹{data.pmfby_sum_insured_inr?.toLocaleString('en-IN') || '0'}
                  </p>
                </div>
                
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500 font-medium">Claim Amount</p>
                  <p className="text-xl font-semibold text-gray-900">
                    ₹{data.pmfby_claim_amount_inr?.toLocaleString('en-IN') || '0'}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 bg-gray-50 -mx-6 px-6 -mb-6 pb-6 rounded-b-2xl mt-4">
                  <p className="text-sm text-gray-500 font-medium mt-4">Claim Ratio</p>
                  <div className="flex items-end gap-2 mt-1">
                    <p className={`text-3xl font-bold ${Number(claimRatio) > 100 ? 'text-red-600' : 'text-gray-900'}`}>
                      {claimRatio}%
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Rainfall Chart Section */}
            <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Rainfall Overview</h2>
              <RainfallChart 
                actualRainfall={data.actual_rainfall_mm ?? null}
                normalRainfall={data.normal_rainfall_mm ?? null}
                deficitPct={data.rainfall_deficit_pct ?? null}
              />
            </section>
            
          </div>
        </div>
      </main>
    </div>
  );
}
