import React from 'react';
import { OrdexaWordmark } from './Primitives';

export function BrandLogo({ compact = false, subtitle = '' }) {
  return (
    <div className="inline-flex flex-col select-none">
      <OrdexaWordmark size={compact ? 'sm' : 'md'} />
      {subtitle && !compact && (
        <span className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-[#8891AA] mt-1">
          {subtitle}
        </span>
      )}
    </div>
  );
}
