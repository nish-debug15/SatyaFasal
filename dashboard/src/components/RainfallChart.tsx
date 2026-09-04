'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface RainfallChartProps {
  actualRainfall: number | null;
  normalRainfall: number | null;
  deficitPct: number | null;
}

export default function RainfallChart({ actualRainfall, normalRainfall, deficitPct }: RainfallChartProps) {
  if (actualRainfall === null || normalRainfall === null) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 min-h-[200px]">
        <p className="text-sm text-gray-500">No rainfall data available</p>
      </div>
    );
  }

  const data = [
    {
      name: 'Actual',
      value: actualRainfall,
      color: '#3b82f6' // blue-500
    },
    {
      name: 'Normal',
      value: normalRainfall,
      color: '#9ca3af' // gray-400
    }
  ];

  return (
    <div className="w-full flex flex-col h-full min-h-[250px]">
      <div className="flex-grow w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(val) => [`${val} mm`, 'Rainfall']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {deficitPct !== null && (
        <div className="mt-2 text-center text-sm font-medium">
          {deficitPct > 0 ? (
            <span className="text-red-600">Deficit: {deficitPct}%</span>
          ) : deficitPct < 0 ? (
            <span className="text-blue-600">Excess: {Math.abs(deficitPct)}%</span>
          ) : (
            <span className="text-emerald-600">Normal</span>
          )}
        </div>
      )}
    </div>
  );
}
