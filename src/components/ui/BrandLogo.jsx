import React from 'react';

export function BrandLogo({ variant = 'block', compact = false }) {
  const mark = (
    <svg
      width={compact ? 22 : 26}
      height={compact ? 22 : 26}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 2L25 8.2V19.8L14 26L3 19.8V8.2L14 2Z"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M14 7.5L20 11V17L14 20.5L8 17V11L14 7.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="14" cy="14" r="2.4" fill="currentColor" />
    </svg>
  );

  if (variant === 'block') {
    return (
      <div className="inline-flex items-center gap-2.5 bg-gold text-navy-dark px-5 py-3.5 select-none">
        {mark}
        <div className="leading-none">
          <div className="font-serif font-bold tracking-wider text-xl text-navy-dark">ORDEXA</div>
          {!compact && (
            <div className="text-[9px] uppercase tracking-[0.2em] font-semibold text-navy-dark/80 mt-0.5">
              Order Intelligence
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <span className="text-gold">{mark}</span>
      <div className="leading-none">
        <div className="font-serif font-bold tracking-wider text-lg text-white">ORDEXA</div>
        {!compact && (
          <div className="text-[9px] uppercase tracking-[0.18em] text-gold/80 mt-0.5">
            RTO Prevention
          </div>
        )}
      </div>
    </div>
  );
}
