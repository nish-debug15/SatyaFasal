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
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-6 min-h-[220px]">
        <CloudRain className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-xs text-slate-500 font-medium">No rainfall data available for this window</p>
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
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600 border border-sky-200">
            <CloudRain className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Rainfall Drop & Deficit</h4>
            <p className="text-xs text-slate-500">Open-Meteo & IMD Precipitation Record</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50/80 border border-sky-200 text-sky-800 text-[11px] font-semibold">
          <Droplets className="w-3 h-3 text-sky-600" />
          <span>Total: {actualRainfall.toFixed(0)} mm</span>
        </div>
      </div>

      {/* Deficit Callout Banner */}
      <div className="my-3 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {deficitPct !== null ? (
            deficitPct > 0 ? (
              <TrendingDown className="w-4 h-4 text-rose-600" />
            ) : (
              <TrendingUp className="w-4 h-4 text-sky-600" />
            )
          ) : null}
          <span className="text-xs text-slate-600">Rainfall Deviation:</span>
          <span className="text-xs font-bold text-slate-900">
            {deficitPct !== null ? `${deficitPct > 0 ? '-' : '+'}${Math.abs(deficitPct).toFixed(1)}%` : 'N/A'}
          </span>
        </div>

        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
            isDrought
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : isExcess
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {isDrought ? (
            <>
              <AlertTriangle className="w-3 h-3" />
              <span>DROUGHT DEFICIT DETECTED</span>
            </>
          ) : isExcess ? (
            <>
              <Droplets className="w-3 h-3" />
              <span>SURPLUS RAIN (CONTRADICTS DROUGHT)</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3" />
              <span>NORMAL RAINFALL RANGE</span>
            </>
          )}
        </span>
      </div>

      {/* Bar Chart */}
      <div className="w-full h-44 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} unit=" mm" />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg">
                      <p className="font-semibold text-slate-200">{item.name}</p>
                      <p className="text-sky-400 font-bold mt-0.5">{item.display}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
              <Cell fill={isExcess ? '#0284c7' : '#38bdf8'} />
              <Cell fill="#94a3b8" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Explainer */}
      <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
        <span className="font-semibold text-slate-700">Weather Logic:</span> Claims citing drought loss require a verified rainfall deficit &gt; 20% against the 10-year IMD district normal. Surplus or normal rainfall contradicts drought loss claims.
      </p>
    </div>
  );
}
