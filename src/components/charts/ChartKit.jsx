import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const CHART = {
  peri: '#7584D6',
  indigo: '#545C9E',
  violet: '#9493F6',
  cyan: '#72E1FF',
  pink: '#FF9FD7',
  cobalt: '#4A78D6',
  coral: '#FA9A7C',
  orange: '#FA6E43',
  emerald: '#34C78A',
  rose: '#F26B8A',
  slate: '#9AA3BA',
};

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: '#9AA3BA', fontFamily: 'Manrope, Inter, sans-serif', fontWeight: 500 },
};

export const gridProps = {
  stroke: '#EDF0FA',
  strokeDasharray: '0',
  vertical: false,
};

export function ChartTooltip({ active, payload, label, valueFormatter, labelPrefix = '' }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-[#DFE1F5] rounded-[16px] shadow-rescale-hover px-3.5 py-2.5 min-w-[155px]">
      {label !== undefined && (
        <div className="text-[11px] font-display font-bold text-[#465478] mb-1.5 pb-1 border-b border-[#F1F2F9]">
          {labelPrefix}
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey ?? entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[#6B7694]">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color || entry.payload?.color || '#7584D6' }}
              />
              {entry.name}
            </span>
            <span className="text-[12px] font-display font-bold text-[#465478] num">
              {valueFormatter ? valueFormatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Exact 1:1 reproduction of the Rescale Dashboard "Performance Analytics"
 * Mirrored Capsule Bar Chart (yioKaA8bRLLQL0qPi6fHfl3sw4.jpg)
 */
export function MirroredCapsuleChart({
  data = [],
  topLabel = 'Verified Deliveries',
  bottomLabel = 'RTO Risk Insights',
  maxVal = 60,
  unitSuffix = 'K',
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <div className="relative select-none">
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-2 items-stretch">
        {/* Y-Axis Symmetric Scale (60K -> 0K -> 60K) */}
        <div className="flex flex-col justify-between py-1 text-[11px] font-display font-medium text-[#B0B8CD] text-right pr-1 h-[248px] num">
          <span>{maxVal}{unitSuffix}</span>
          <span>{Math.round((maxVal * 2) / 3)}{unitSuffix}</span>
          <span>{Math.round(maxVal / 3)}{unitSuffix}</span>
          <span className="text-[#8E98B2]">0{unitSuffix}</span>
          <span>{Math.round(maxVal / 3)}{unitSuffix}</span>
          <span>{Math.round((maxVal * 2) / 3)}{unitSuffix}</span>
          <span>{maxVal}{unitSuffix}</span>
        </div>

        {/* Plot Area */}
        <div className="relative h-[248px] flex flex-col justify-between">
          {/* Subtle Horizontal Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
            {[0, 1, 2, 3, 4, 5, 6].map((line) => (
              <div
                key={line}
                className={`w-full border-t ${
                  line === 3 ? 'border-[#DFE1F5]' : 'border-[#F1F3FA]'
                }`}
              />
            ))}
          </div>

          {/* Columns */}
          <div
            className="relative z-10 h-full grid items-center gap-1.5 px-1"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))` }}
          >
            {data.map((d, i) => {
              const upPct = Math.min(96, Math.max(12, (d.top / maxVal) * 100));
              const downPct = Math.min(96, Math.max(12, (d.bottom / maxVal) * 100));
              const isHovered = hoveredIdx === i;

              return (
                <div
                  key={d.label}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="relative h-full flex flex-col items-center justify-center group cursor-pointer"
                >
                  {isHovered && (
                    <div className="absolute -top-2 z-20 bg-white border border-[#DFE1F5] rounded-[14px] shadow-rescale-hover px-3 py-1.5 whitespace-nowrap text-[11px] pointer-events-none animate-fade-in">
                      <div className="font-display font-bold text-[#465478]">{d.label}</div>
                      <div className="text-[#7584D6] font-semibold num">
                        {topLabel}: {d.topFormatted || `${d.top}${unitSuffix}`}
                      </div>
                      <div className="text-[#FA6E43] font-semibold num">
                        {bottomLabel}: {d.bottomFormatted || `${d.bottom}${unitSuffix}`}
                      </div>
                    </div>
                  )}

                  {/* Top Half (Periwinkle Rounded Capsule) */}
                  <div className="w-full h-1/2 flex items-end justify-center pb-[1px]">
                    <div
                      className="w-[10px] sm:w-[12px] rounded-t-full transition-all duration-300 group-hover:brightness-105"
                      style={{
                        height: `${upPct}%`,
                        background: 'linear-gradient(180deg, #6E7CD8 0%, #8390E2 100%)',
                      }}
                    />
                  </div>

                  {/* Bottom Half (Soft Coral-Salmon Mirrored Capsule) */}
                  <div className="w-full h-1/2 flex items-start justify-center pt-[1px]">
                    <div
                      className="w-[10px] sm:w-[12px] rounded-b-full transition-all duration-300 group-hover:brightness-105"
                      style={{
                        height: `${downPct}%`,
                        background: 'linear-gradient(180deg, #FBA589 0%, #F79474 100%)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-Axis Labels */}
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-2 mt-2.5">
        <div />
        <div
          className="grid text-center text-[11.5px] font-display font-medium text-[#A3ADC2]"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))` }}
        >
          {data.map((d) => (
            <span key={d.label} className="truncate">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Exact 1:1 reproduction of the Rescale Dashboard "Resource Distribution"
 * Pop-Out Donut Chart (yioKaA8bRLLQL0qPi6fHfl3sw4.jpg)
 */
export function PopOutDonutChart({
  items = [],
  calloutTitle = 'AI Rescue',
  calloutSubtitle = 'Engine',
}) {
  const safeItems = items.length
    ? items
    : [
        { name: 'COD Verification', value: 32, color: '#FF9FD7' },
        { name: 'Storefront Sync', value: 24, color: '#72E1FF' },
        { name: 'NDR Intercept', value: 20, color: '#4A78D6' },
        { name: 'AI Rescue Rules', value: 24, color: '#8C8CF5' },
      ];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="relative h-[220px] flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeItems}
              dataKey="value"
              nameKey="name"
              cx="48%"
              cy="54%"
              innerRadius={52}
              outerRadius={84}
              startAngle={185}
              endAngle={-175}
              stroke="none"
              paddingAngle={0}
            >
              {safeItems.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}%`} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Signature Pop-Out Top-Right Violet Quarter Callout (Exact match to template screenshot) */}
        <div
          className="pointer-events-none absolute top-1 right-3 sm:right-5 w-[108px] h-[94px] flex flex-col items-center justify-center text-white text-center px-2"
          style={{
            background: 'linear-gradient(145deg, #9C9BF8 0%, #7C84DE 100%)',
            borderRadius: '18px 84px 18px 28px',
            boxShadow: '0 16px 28px -8px rgba(84, 92, 158, 0.42)',
          }}
        >
          <span className="font-display font-bold text-[12.5px] leading-tight drop-shadow-sm">
            {calloutTitle}
          </span>
          {calloutSubtitle && (
            <span className="font-display font-semibold text-[11.5px] text-white/90 leading-tight">
              {calloutSubtitle}
            </span>
          )}
        </div>
      </div>

      {/* 2x2 Legend matching template */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2">
        {safeItems.map((it) => (
          <div key={it.name} className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: it.color }}
            />
            <span className="text-[12px] font-display font-medium text-[#465478] truncate">
              {it.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
