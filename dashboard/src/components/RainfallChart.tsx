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
import { CloudRain, Droplets, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface RainfallChartProps {
  actualRainfall: number | null;
  normalRainfall: number | null;
  deficitPct: number | null;
  supportsDrought?: boolean | string | null;
}

export default function RainfallChart({
  actualRainfall,
  normalRainfall,
  deficitPct,
  supportsDrought
}: RainfallChartProps) {
  if (actualRainfall === null || normalRainfall === null) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-paper rounded border border-rule p-6 min-h-[220px]">
        <CloudRain className="w-8 h-8 text-ink-disabled mb-2" />
        <p className="text-xs text-ink-secondary font-medium">No rainfall data available for this window</p>
      </div>
    );
  }

  const isDrought = deficitPct !== null && deficitPct > 20; // Deficit > 20% defines drought
  const isExcess = deficitPct !== null && deficitPct < 0;

  const data = [
    {
      name: 'Actual Observed',
      value: actualRainfall,
      display: `${actualRainfall.toFixed(1)} mm`,
      type: 'actual'
    },
    {
      name: 'Normal Baseline',
      value: normalRainfall,
      display: `${normalRainfall.toFixed(1)} mm`,
      type: 'normal'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-surface rounded border border-rule p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-rule/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-white text-ink-secondary border border-rule">
            <CloudRain className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">Rainfall Drop & Deficit</h4>
            <p className="text-xs text-ink-secondary">Open-Meteo & IMD Precipitation Record</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white border border-rule text-ink-secondary text-[11px] font-medium">
          <Droplets className="w-3 h-3 text-ink-secondary" />
          <span>Total: <span className="font-bold font-data text-ink">{actualRainfall.toFixed(0)} mm</span></span>
        </div>
      </div>

      {/* Deficit Callout Banner */}
      <div className="my-3 p-3 rounded bg-paper border border-rule/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {deficitPct !== null ? (
            deficitPct > 0 ? (
              <TrendingDown className="w-4 h-4 text-flag-red" />
            ) : (
              <TrendingUp className="w-4 h-4 text-ink-secondary" />
            )
          ) : null}
          <span className="text-xs text-ink-secondary">Rainfall Deviation:</span>
          <span className="text-xs font-bold font-data text-ink">
            {deficitPct !== null ? `${deficitPct > 0 ? '-' : '+'}${Math.abs(deficitPct).toFixed(1)}%` : 'N/A'}
          </span>
        </div>

        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border inline-flex items-center gap-1 ${
            isDrought
              ? 'text-flag-amber border-flag-amber/40 bg-white'
              : isExcess
              ? 'text-flag-red border-flag-red/40 bg-white'
              : 'text-flag-green border-flag-green/40 bg-white'
          }`}
        >
          {isDrought ? (
            <>
              <AlertTriangle className="w-3 h-3" />
              <span>Drought deficit detected</span>
            </>
          ) : isExcess ? (
            <>
              <Droplets className="w-3 h-3" />
              <span>Surplus rain (contradicts drought)</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3" />
              <span>Normal rainfall range</span>
            </>
          )}
        </span>
      </div>

      {/* Bar Chart */}
      <div className="w-full h-44 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D6D3CE" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7A7672', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7A7672', fontSize: 11 }} unit=" mm" />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white px-3 py-2 rounded text-xs shadow-lg">
                      <p className="font-medium text-slate-200">{item.name}</p>
                      <p className="text-sky-400 font-bold font-data mt-0.5">{item.display}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
              <Cell fill={isExcess ? '#0284c7' : '#38bdf8'} />
              <Cell fill="#94a3b8" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Explainer */}
      <p className="mt-3 text-[11px] text-ink-secondary leading-relaxed">
        <span className="font-medium text-ink">Weather Logic:</span> Claims citing drought loss require a verified rainfall deficit &gt; 20% against the 10-year IMD district normal. Surplus or normal rainfall contradicts drought loss claims.
      </p>
    </div>
  );
}
