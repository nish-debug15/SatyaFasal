'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function VillageDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: records, error } = await supabase
        .from('master_eval_dataset')
        .select('*')
        .eq('id', id)
        .single();
      if (records) {
        setData(records);
      }
      setLoading(false);
    }
    fetchData();
  }, [id]);

  if (loading) return <div className="p-8 max-w-4xl mx-auto text-gray-500">Loading details...</div>;
  if (!data) return <div className="p-8 max-w-4xl mx-auto text-red-500">Village not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <Link href="/" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </Link>

      <div className="bg-white shadow rounded-lg p-6 mb-8 border border-gray-200">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{data.village_name}</h1>
            <p className="text-gray-500">{data.taluk}, {data.district} District • {data.season} {data.year}</p>
          </div>
          <div className="flex gap-2">
            <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-semibold ${data.multimodal_verdict === 'INCONCLUSIVE' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
              Pipeline: {data.multimodal_verdict}
            </span>
            <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-semibold ${data.fraud_label === 'MISMATCH' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
              Signal: {data.fraud_label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Ground Truth Signals</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">NDVI Satellite (Optical)</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {data.ndvi_reliable ? (
                    `Reliable (Delta: ${data.ndvi_change?.toFixed(2)})`
                  ) : (
                    <span className="text-orange-600 font-medium">Cloud Contaminated ({data.s2_cloud_pct_post?.toFixed(1)}%)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">SAR VV (Radar Fallback)</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {data.s1_fallback_used === 1 ? (
                    data.s1_vv_db_post ? `Fallback Used (Delta: ${(data.s1_vv_db_post - data.s1_vv_db_pre).toFixed(2)} dB)` : 'No data available'
                  ) : 'Not needed'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Rainfall (IMD)</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {data.actual_rainfall_mm?.toFixed(1)}mm (Deficit: {data.rainfall_deficit_pct?.toFixed(1)}%)
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">KSDMA Drought Declaration</dt>
                <dd className="mt-1 text-sm text-gray-500 italic">No data available (Unverified)</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">DES Yield Historical</dt>
                <dd className="mt-1 text-sm text-gray-500 italic">No data available (Granularity mismatch)</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Claim Details</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Reported Claims</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.pmfby_claims_reported}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Sum Insured</dt>
                <dd className="mt-1 text-sm text-gray-900">₹{data.pmfby_sum_insured_inr?.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Claim Amount</dt>
                <dd className="mt-1 text-sm text-gray-900">₹{data.pmfby_claim_amount_inr?.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 shadow rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">AI Explanation</h3>
          <div className="flex gap-2">
            {!data.llm_is_simulated ? (
              <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-100 rounded-full px-2.5 py-1">
                <ShieldCheck className="w-3 h-3 mr-1" /> AI-generated, verified against deterministic signals
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-100 rounded-full px-2.5 py-1">
                <ShieldAlert className="w-3 h-3 mr-1" /> Simulated (rate-limited)
              </span>
            )}
          </div>
        </div>
        <div className="prose prose-sm max-w-none text-gray-700 bg-white p-4 rounded border whitespace-pre-wrap">
          {data.llm_explanation}
        </div>
      </div>
    </div>
  );
}
