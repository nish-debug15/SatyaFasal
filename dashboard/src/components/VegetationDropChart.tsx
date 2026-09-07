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
          { name: 'Pre-loss period', value: s1VvPre, display: `${s1VvPre?.toFixed(2)} dB` },
          { name: 'Post-loss period', value: s1VvPost, display: `${s1VvPost?.toFixed(2)} dB` },
        ]
      : [];

    return (
      <div className="flex flex-col h-full bg-surface rounded border border-rule p-5">
        {/* Header with Radar Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-rule/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-white text-ink-secondary border border-rule">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink">Vegetation drop (SAR radar)</h4>
              <p className="text-xs text-ink-secondary">Sentinel-1 VV backscatter (dB)</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white border border-flag-amber/40 text-flag-amber text-[11px] font-medium">
            <Cloud className="w-3 h-3" />
            <span>Cloud fallback active ({cloudPctPost?.toFixed(0) || '95'}% cloudy)</span>
          </div>
        </div>

        {/* Status Callout */}
        <div className="my-3 p-3 rounded bg-paper border border-rule/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {sarDelta !== null ? (
              sarDelta > 0 ? (
                <TrendingUp className="w-4 h-4 text-flag-red" />
              ) : sarDelta < -1.5 ? (
                <TrendingDown className="w-4 h-4 text-flag-green" />
              ) : (
                <Minus className="w-4 h-4 text-ink-secondary" />
              )
            ) : null}
            <span className="text-xs text-ink-secondary">Canopy signal change:</span>
            <span className="text-xs font-bold font-data text-ink">
              {sarDelta !== null ? `${sarDelta > 0 ? '+' : ''}${sarDelta.toFixed(2)} dB` : 'N/A'}
            </span>
          </div>

          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border ${
              lossObserved
                ? 'text-flag-green border-flag-green/40 bg-white'
                : 'text-flag-red border-flag-red/40 bg-white'
            }`}
          >
            {lossObserved ? 'Vegetation loss detected' : 'No vegetation drop (contradiction)'}
          </span>
        </div>

        {/* Chart */}
        {hasSarData ? (
          <div className="w-full h-44 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D6D3CE" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7A7672', fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#7A7672', fontSize: 11 }}
                  unit=" dB"
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ fill: '#F7F6F3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-ink text-white px-3 py-2 rounded text-xs">
                          <p className="font-medium text-white/70">{data.name}</p>
                          <p className="font-bold font-data mt-0.5">{data.display}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={-10} stroke="#D6D3CE" strokeDasharray="3 3" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                  <Cell fill="#6366f1" />
                  <Cell fill={lossObserved ? '#10b981' : '#f43f5e'} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-44 flex items-center justify-center bg-paper rounded text-xs text-ink-disabled">
            No SAR radar backscatter recordings found for this window.
          </div>
        )}

        {/* Technical Explainer */}
        <p className="mt-3 text-[11px] text-ink-secondary leading-relaxed">
          <span className="font-medium text-ink">Radar logic:</span> True crop loss causes radar backscatter to drop below <span className="font-medium font-data text-ink">−1.5 dB</span> as crop canopy disappears. An unchanged or increasing dB indicates canopy remained intact.
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
        { name: 'Pre-loss NDVI', value: ndviPre, display: ndviPre?.toFixed(3) },
        { name: 'Post-loss NDVI', value: ndviPost, display: ndviPost?.toFixed(3) },
      ]
    : [];

  return (
    <div className="flex flex-col h-full bg-surface rounded border border-rule p-5">
      <div className="flex items-center justify-between pb-3 border-b border-rule/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-white text-ink-secondary border border-rule">
            <Satellite className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">Vegetation drop (optical NDVI)</h4>
            <p className="text-xs text-ink-secondary">Sentinel-2 normalised difference vegetation index</p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-sm bg-white border border-flag-green/40 text-flag-green text-[11px] font-medium">
          Cloud free (&lt;50%)
        </span>
      </div>

      <div className="my-3 p-3 rounded bg-paper border border-rule/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-secondary">NDVI change:</span>
          <span className="text-xs font-bold font-data text-ink">
            {ndviDelta !== null ? `${ndviDelta > 0 ? '+' : ''}${ndviDelta.toFixed(3)}` : 'N/A'}
          </span>
        </div>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border ${
            lossObserved
              ? 'text-flag-green border-flag-green/40 bg-white'
              : 'text-flag-red border-flag-red/40 bg-white'
          }`}
        >
          {lossObserved ? 'Vegetation loss detected' : 'No vegetation drop (contradiction)'}
        </span>
      </div>

      {hasNdvi ? (
        <div className="w-full h-44 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D6D3CE" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7A7672', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7A7672', fontSize: 11 }} domain={[0, 1]} />
              <Tooltip
                cursor={{ fill: '#F7F6F3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-ink text-white px-3 py-2 rounded text-xs">
                        <p className="font-medium text-white/70">{data.name}</p>
                        <p className="font-bold font-data mt-0.5">{data.display}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                <Cell fill="#10b981" />
                <Cell fill={lossObserved ? '#f43f5e' : '#3b82f6'} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-44 flex items-center justify-center bg-paper rounded text-xs text-ink-disabled">
          No NDVI data available.
        </div>
      )}

      <p className="mt-3 text-[11px] text-ink-secondary leading-relaxed">
        <span className="font-medium text-ink">NDVI logic:</span> Healthy crop canopy measures 0.40–0.80. A decline &gt; 0.15 indicates visible vegetation distress or loss.
      </p>
    </div>
  );
}
