'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { Radio, Satellite, Cloud, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface VegetationDropChartProps {
  s1FallbackUsed: number | boolean | null;
  s1VvPre: number | null;
  s1VvPost: number | null;
  ndviReliable: boolean | null;
  ndviPre: number | null;
  ndviPost: number | null;
  cloudPctPre?: number | null;
  cloudPctPost?: number | null;
  supportsLoss?: string | boolean | null;
}

export default function VegetationDropChart({
  s1FallbackUsed,
  s1VvPre,
  s1VvPost,
  ndviReliable,
  ndviPre,
  ndviPost,
  cloudPctPre,
  cloudPctPost,
  supportsLoss
}: VegetationDropChartProps) {
  const isRadarFallback = s1FallbackUsed === 1 || s1FallbackUsed === true || !ndviReliable;

  if (isRadarFallback) {
    const hasSarData = s1VvPre !== null && s1VvPost !== null;
    const sarDelta = hasSarData ? (s1VvPost! - s1VvPre!) : null;
    const lossObserved = sarDelta !== null && sarDelta < -1.5;

    const chartData = hasSarData
      ? [
          { name: 'Pre-Loss Period', value: s1VvPre, display: `${s1VvPre?.toFixed(2)} dB` },
          { name: 'Post-Loss Period', value: s1VvPost, display: `${s1VvPost?.toFixed(2)} dB` },
        ]
      : [];

    return (
      <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        {/* Header with Radar Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Vegetation Drop (SAR Radar)</h4>
              <p className="text-xs text-slate-500">Sentinel-1 VV Backscatter (dB)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50/80 border border-amber-200 text-amber-800 text-[11px] font-semibold">
            <Cloud className="w-3 h-3 text-amber-600" />
            <span>Cloud Fallback Active ({cloudPctPost?.toFixed(0) || '95'}% Cloudy)</span>
          </div>
        </div>

        {/* Status Callout */}
        <div className="my-3 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {sarDelta !== null ? (
              sarDelta > 0 ? (
                <TrendingUp className="w-4 h-4 text-rose-600" />
              ) : sarDelta < -1.5 ? (
                <TrendingDown className="w-4 h-4 text-emerald-600" />
              ) : (
                <Minus className="w-4 h-4 text-slate-500" />
              )
            ) : null}
            <span className="text-xs text-slate-600">Canopy Signal Change:</span>
            <span className="text-xs font-bold text-slate-900">
              {sarDelta !== null ? `${sarDelta > 0 ? '+' : ''}${sarDelta.toFixed(2)} dB` : 'N/A'}
            </span>
          </div>

          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
              lossObserved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {lossObserved ? 'VEGETATION LOSS DETECTED' : 'NO VEGETATION DROP (CONTRADICTION)'}
          </span>
        </div>

        {/* Chart */}
        {hasSarData ? (
          <div className="w-full h-44 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  unit=" dB"
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg">
                          <p className="font-semibold text-slate-200">{data.name}</p>
                          <p className="text-emerald-400 font-bold mt-0.5">{data.display}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={-10} stroke="#cbd5e1" strokeDasharray="3 3" />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  <Cell fill="#6366f1" />
                  <Cell fill={lossObserved ? '#10b981' : '#f43f5e'} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-44 flex items-center justify-center bg-slate-50 rounded-lg text-xs text-slate-400">
            No SAR radar backscatter recordings found for this window.
          </div>
        )}

        {/* Technical Explainer */}
        <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-700">Radar Logic:</span> True crop loss causes radar backscatter to drop below <span className="font-semibold text-slate-800">-1.5 dB</span> as crop canopy disappears. An unchanged or increasing dB indicates canopy remained intact.
        </p>
      </div>
    );
  }

  // Optical NDVI Mode
  const hasNdvi = ndviPre !== null && ndviPost !== null;
  const ndviDelta = hasNdvi ? (ndviPost! - ndviPre!) : null;
  const lossObserved = ndviDelta !== null && ndviDelta < -0.15;

  const chartData = hasNdvi
    ? [
        { name: 'Pre-Loss NDVI', value: ndviPre, display: ndviPre?.toFixed(3) },
        { name: 'Post-Loss NDVI', value: ndviPost, display: ndviPost?.toFixed(3) },
      ]
    : [];

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Satellite className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Vegetation Drop (Optical NDVI)</h4>
            <p className="text-xs text-slate-500">Sentinel-2 Normalized Difference Vegetation Index</p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
          Cloud Free (&lt;50%)
        </span>
      </div>

      <div className="my-3 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">NDVI Change:</span>
          <span className="text-xs font-bold text-slate-900">
            {ndviDelta !== null ? `${ndviDelta > 0 ? '+' : ''}${ndviDelta.toFixed(3)}` : 'N/A'}
          </span>
        </div>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
            lossObserved
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {lossObserved ? 'VEGETATION LOSS DETECTED' : 'NO VEGETATION DROP (CONTRADICTION)'}
        </span>
      </div>

      {hasNdvi ? (
        <div className="w-full h-44 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 1]} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg">
                        <p className="font-semibold text-slate-200">{data.name}</p>
                        <p className="text-emerald-400 font-bold mt-0.5">{data.display}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                <Cell fill="#10b981" />
                <Cell fill={lossObserved ? '#f43f5e' : '#3b82f6'} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-44 flex items-center justify-center bg-slate-50 rounded-lg text-xs text-slate-400">
          No NDVI data available.
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
        <span className="font-semibold text-slate-700">NDVI Logic:</span> Healthy crop canopy measures 0.40–0.80. A decline &gt; 0.15 indicates visible vegetation distress or loss.
      </p>
    </div>
  );
}
