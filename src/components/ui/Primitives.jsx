import React, { useEffect, useId } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { getAttentionStyles, getStatusStyles } from '../../utils/formatters';
import { useOrdexaStore } from '../../store/useOrdexaStore';

/* ------------------------------------------------------------------ */
/* Rescale-Template Brand Wordmark (northstar® in cyan->periwinkle)   */
/* ------------------------------------------------------------------ */

export function OrdexaWordmark({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'text-[22px]',
    md: 'text-[28px]',
    lg: 'text-[34px]',
  };
  return (
    <span
      className={`inline-flex items-start font-display font-extrabold tracking-[-0.045em] leading-none select-none ${sizes[size] || sizes.md
        } ${className}`}
    >
      <span className="rescale-wordmark-text">northstar</span>
      <sup className="text-[10px] font-semibold text-[#7584D6] ml-0.5 mt-1">®</sup>
    </span>
  );
}

export function ModularGridIcon({ size = 16, className = '' }) {
  return (
    <span
      className={`inline-grid grid-cols-2 gap-[2.5px] flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="rounded-[2px] bg-[#80E5FF]" />
      <span className="rounded-[2px] bg-[#7584D6]" />
      <span className="rounded-[2px] bg-[#7584D6]" />
      <span className="rounded-[2px] bg-[#A5A4FA]" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Pill Buttons ("Desktop - Blue" & "Desktop - White" from template)  */
/* ------------------------------------------------------------------ */

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-display font-semibold rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-peri-400/40 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-[0.98]';

  const variants = {
    primary:
      'bg-rescale-btn text-white shadow-rescale-btn hover:brightness-105',
    secondary:
      'bg-[#F1F2F9] text-[#465478] hover:bg-[#E3E6FA] border border-[#DFE1F5]',
    outline:
      'bg-rescale-white text-[#465478] border border-[#DFE1F5] shadow-rescale-white hover:border-[#C5CAEC]',
    outlineLight:
      'bg-white/20 text-white border border-white/40 hover:bg-white/30 backdrop-blur-md',
    danger:
      'bg-[#FFF0F2] text-[#D13B56] hover:bg-[#FFE2E7] border border-[#FECDD6]',
    success:
      'bg-[#ECFEF6] text-[#17825B] hover:bg-[#D5FAE9] border border-[#C3F3DE]',
    ghost:
      'bg-transparent text-[#6A7594] hover:text-[#465478] hover:bg-[#F1F2F9] border border-transparent',
  };

  const sizes = {
    xs: 'h-7 text-[11.5px] px-3',
    sm: 'h-9 text-[12.5px] px-4',
    md: 'h-10 text-[13.5px] px-5',
    lg: 'h-12 text-[14.5px] px-6',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function SectionEyebrow({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-[#E3E6FA] shadow-rescale-card text-[11px] font-display font-bold uppercase tracking-[0.14em] text-[#545C9E] ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#7584D6]" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Circular Ringed Pastel Icon & Cards (Exact match to Spotlight UI)   */
/* ------------------------------------------------------------------ */

const RING_TONES = {
  coral: 'bg-[#FFF5F0] text-[#FA845D] border-[#FFE4D8]',
  orange: 'bg-[#FFF5F0] text-[#FA845D] border-[#FFE4D8]',
  amber: 'bg-[#FFF7ED] text-[#EA8A35] border-[#FDE6C9]',
  peri: 'bg-[#F4F5FC] text-[#7584D6] border-[#E3E6FA]',
  brand: 'bg-[#F4F5FC] text-[#7584D6] border-[#E3E6FA]',
  indigo: 'bg-[#F4F5FC] text-[#7584D6] border-[#E3E6FA]',
  violet: 'bg-[#F6F5FF] text-[#8D8CF4] border-[#E6E5FD]',
  pink: 'bg-[#FFF3FA] text-[#EC7CC0] border-[#FCDCF0]',
  rose: 'bg-[#FFF1F4] text-[#E66482] border-[#FDD5DF]',
  cyan: 'bg-[#EEFBFF] text-[#35B9DC] border-[#CCF2FE]',
  sky: 'bg-[#EEFBFF] text-[#35B9DC] border-[#CCF2FE]',
  emerald: 'bg-[#EEFCF6] text-[#2EB37E] border-[#CCF4E3]',
  ink: 'bg-[#F1F2F9] text-[#465478] border-[#DFE1F5]',
  slate: 'bg-[#F1F2F9] text-[#465478] border-[#DFE1F5]',
  dark: 'bg-white/20 text-white border-white/30',
};

export function IconTile({ icon: Icon, tone = 'peri', size = 'md', className = '' }) {
  if (!Icon) return null;
  const sizes = {
    sm: 'w-9 h-9 rounded-full',
    md: 'w-11 h-11 rounded-full',
    lg: 'w-14 h-14 rounded-full',
  };
  return (
    <span
      className={`inline-flex items-center justify-center border shadow-icon-ring flex-shrink-0 ${RING_TONES[tone] || RING_TONES.peri
        } ${sizes[size] || sizes.md} ${className}`}
    >
      <Icon className={size === 'lg' ? 'w-5 h-5' : size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
    </span>
  );
}

export function Card({ children, featured = false, className = '', ...props }) {
  return (
    <div
      className={`rounded-[22px] transition-all ${featured
        ? 'bg-rescale-btn text-white shadow-rescale-btn border border-[#8D96EA]'
        : 'rescale-card text-[#465478]'
        } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mb-3.5 ${className}`}>
      <div>
        <h2 className="font-display text-[19px] sm:text-[20px] font-bold text-[#465478] tracking-[-0.02em]">
          {title}
        </h2>
        {subtitle && <p className="text-[12.5px] text-[#7D87A3] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardHeader({
  icon: Icon,
  iconTone = 'peri',
  title,
  subtitle,
  action,
  className = '',
}) {
  return (
    <div
      className={`px-6 py-4 border-b border-[#F1F2F9] flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <IconTile icon={Icon} tone={iconTone} size="sm" />}
        <div className="min-w-0">
          <h3 className="font-display text-[15.5px] font-bold text-[#465478] tracking-[-0.015em] truncate">
            {title}
          </h3>
          {subtitle && <p className="text-[12px] text-[#8891AA] mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  accentWord,
  subtitle,
  actions,
  badge,
  icon: Icon,
  iconTone = 'peri',
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
      <div className="min-w-0">
        {(eyebrow || badge) && (
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {eyebrow && (
              <span className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-[#7584D6]">
                {eyebrow}
              </span>
            )}
            {badge}
          </div>
        )}
        <div className="flex items-center gap-3">
          {Icon && <IconTile icon={Icon} tone={iconTone} size="md" />}
          <div>
            <h1 className="font-display text-[22px] sm:text-[25px] font-bold text-[#465478] tracking-[-0.025em] leading-tight">
              {title}
              {accentWord && <span className="rescale-gradient-text"> {accentWord}</span>}
            </h1>
            {subtitle && (
              <p className="text-[13px] text-[#7C86A2] mt-1 max-w-2xl leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rescale Spotlight KPI Card (Circular Left Ring + Big Slate Value)   */
/* ------------------------------------------------------------------ */

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'peri',
  delta,
  featured = false,
  onClick,
  className = '',
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[22px] p-5 sm:p-6 transition-all duration-200 ${featured
        ? 'bg-rescale-btn text-white shadow-rescale-btn border border-[#8C95E8]'
        : 'rescale-card text-[#465478]'
        } ${onClick ? 'cursor-pointer rescale-card-hover' : ''} ${className}`}
    >
      <div className="flex items-center gap-4">
        {Icon && (
          <IconTile
            icon={Icon}
            tone={featured ? 'dark' : accent}
            size="lg"
          />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`font-display text-[13px] font-medium truncate ${featured ? 'text-white/85' : 'text-[#5C6888]'
              }`}
          >
            {title}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 flex-wrap">
            <span
              className={`font-display text-[26px] sm:text-[29px] font-extrabold tracking-[-0.03em] num leading-none ${featured ? 'text-white' : 'text-[#465478]'
                }`}
            >
              {value}
            </span>
            {delta && (
              <span
                className={`font-display text-[13.5px] font-bold whitespace-nowrap num ${featured ? 'text-[#D6F5FF]' : 'text-[#8E9AE2]'
                  }`}
              >
                {delta}
              </span>
            )}
          </div>
          {subtitle && (
            <div
              className={`mt-1.5 text-[11.5px] truncate ${featured ? 'text-white/80' : 'text-[#8891AA]'
                }`}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MetricPair({ value, label, sublabel, className = '' }) {
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <div className="font-display text-[26px] font-extrabold rescale-gradient-text num leading-none">
        {value}
      </div>
      <div className="border-l border-[#DFE1F5] pl-3 leading-tight">
        <div className="font-display text-[12.5px] font-bold text-[#465478]">{label}</div>
        {sublabel && <div className="text-[11px] text-[#8891AA] mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badges & Pills                                                      */
/* ------------------------------------------------------------------ */

export function StoreBadge({ store = '' }) {
  let short = store;
  let style = 'bg-[#F1F2F9] text-[#545C9E] border-[#DFE1F5]';
  if (store.toLowerCase().includes('vedaglow')) {
    short = 'Shopify · VedaGlow';
    style = 'bg-[#EEFCF6] text-[#17825B] border-[#C3F3DE]';
  } else if (store.toLowerCase().includes('koracraft')) {
    short = 'Woo · KoraCraft';
    style = 'bg-[#F1F2F9] text-[#545C9E] border-[#DFE1F5]';
  } else if (store.toLowerCase().includes('zaripulse')) {
    short = 'Social · ZariPulse';
    style = 'bg-[#FFF3FA] text-[#B83B82] border-[#FAD1E8]';
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-display font-semibold rounded-full border whitespace-nowrap ${style}`}
    >
      {short}
    </span>
  );
}

export function AttentionBadge({ level }) {
  const s = getAttentionStyles(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold tracking-wider uppercase border whitespace-nowrap ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {level}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-display font-semibold border whitespace-nowrap ${getStatusStyles(
        status
      )}`}
    >
      {status}
    </span>
  );
}

export function ReasonCodePill({ code }) {
  return (
    <span className="inline-block font-mono text-[10.5px] font-medium bg-[#F1F2F9] text-[#545C9E] border border-[#DFE1F5] rounded-full px-2.5 py-0.5 whitespace-nowrap">
      {code}
    </span>
  );
}

export function DeltaPill({ value, direction = 'up', invert = false, suffix = '' }) {
  const positive = invert ? direction === 'down' : direction === 'up';
  const Icon = direction === 'up' ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-display font-bold px-2 py-0.5 rounded-full ${positive ? 'text-[#17825B] bg-[#ECFEF6]' : 'text-[#E05328] bg-[#FFF1EC]'
        }`}
    >
      <Icon className="w-3 h-3" />
      {value}
      {suffix}
    </span>
  );
}

export function Sparkline({ data = [], stroke = '#7584D6', height = 30, className = '' }) {
  const reactId = useId();
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * 100;
      const y = height - 4 - ((d - min) / range) * (height - 8);
      return `${x},${y}`;
    })
    .join(' ');
  const id = `spark-${reactId.replace(/:/g, '')}`;
  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} 100,${height}`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs & Forms                                                        */
/* ------------------------------------------------------------------ */

export function Tabs({ items = [], value, onChange, variant = 'pills', className = '' }) {
  if (variant === 'underline') {
    return (
      <div className={`flex items-center gap-1.5 overflow-x-auto nav-scroll -mb-px ${className}`}>
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] font-display font-semibold border-b-2 transition-colors whitespace-nowrap ${active
                ? 'border-[#7584D6] text-[#465478]'
                : 'border-transparent text-[#8891AA] hover:text-[#465478]'
                }`}
            >
              {item.label}
              {typeof item.count === 'number' && (
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full num ${active ? 'bg-[#E3E6FA] text-[#545C9E]' : 'bg-[#F1F2F9] text-[#8891AA]'
                    }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 bg-[#F1F2F9] border border-[#E3E6FA] rounded-full p-1 overflow-x-auto ${className}`}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-display font-semibold rounded-full transition-all whitespace-nowrap ${active
              ? 'bg-white text-[#465478] shadow-rescale-card'
              : 'text-[#7C86A2] hover:text-[#465478]'
              }`}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span className="font-mono text-[10px] text-[#7584D6] num">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const inputClass =
  'w-full px-3.5 py-2 text-[13px] bg-[#F9FAFB] border border-[#DFE1F5] rounded-[14px] text-[#465478] placeholder:text-[#9CA5BD] focus:outline-none focus:bg-white focus:border-[#7584D6] focus:ring-4 focus:ring-[#7584D6]/12 transition-all';

export function Field({ label, required = false, hint, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11.5px] font-display font-bold text-[#5C6888] mb-1.5">
          {label}
          {required && <span className="text-[#FA6E43] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-[11px] text-[#8891AA] mt-1">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress & Avatar                                                   */
/* ------------------------------------------------------------------ */

export function ProgressBar({ value = 0, max = 100, tone = 'peri', height = 7, className = '' }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / (Number(max) || 100)) * 100));
  const tones = {
    peri: 'bg-[#7584D6]',
    brand: 'bg-[#7584D6]',
    indigo: 'bg-[#545C9E]',
    violet: 'bg-[#A5A4FA]',
    cyan: 'bg-[#52CEEE]',
    pink: 'bg-[#FF9FD7]',
    coral: 'bg-[#FA6E43]',
    rose: 'bg-[#F26B8A]',
    amber: 'bg-[#F59E0B]',
    emerald: 'bg-[#2EB37E]',
  };
  return (
    <div
      className={`w-full bg-[#F1F2F9] rounded-full overflow-hidden ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${tones[tone] || tones.peri}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const AVATAR_PALETTES = [
  'bg-[#F1F2F9] text-[#545C9E] border-[#DFE1F5]',
  'bg-[#FFF3FA] text-[#C2418B] border-[#FAD1E8]',
  'bg-[#EEFBFF] text-[#1D82A8] border-[#C5EEFD]',
  'bg-[#FFF5F0] text-[#D96030] border-[#FDD6C8]',
  'bg-[#EEFCF6] text-[#17825B] border-[#C3F3DE]',
];

export function Avatar({ name = '?', size = 'md', className = '' }) {
  const initials =
    String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] || '')
      .join('')
      .toUpperCase() || '?';

  const hash = String(name)
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const palette = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];

  const sizes = {
    xs: 'w-7 h-7 text-[10.5px]',
    sm: 'w-8 h-8 text-[11.5px]',
    md: 'w-10 h-10 text-[13px]',
    lg: 'w-12 h-12 text-[15px]',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-display font-bold rounded-full border flex-shrink-0 ${palette} ${sizes[size] || sizes.md
        } ${className}`}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays: Modal, Drawer, ConfirmDialog, Toasts                      */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = 'max-w-2xl',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#192038]/35 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${widthClass} rounded-[26px] border border-[#DFE1F5] shadow-panel max-h-[90vh] flex flex-col overflow-hidden animate-fade-up text-[#465478]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-5 bg-[#F9FAFB] border-b border-[#DFE1F5]">
          <div className="min-w-0 pr-3">
            <h3 className="font-display text-[17px] font-bold text-[#465478]">{title}</h3>
            {subtitle && <p className="text-[12.5px] text-[#7D87A3] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-[#8891AA] hover:text-[#465478] p-1.5 rounded-full hover:bg-[#F1F2F9] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#DFE1F5] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = 'max-w-lg',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#192038]/30 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className={`bg-white w-full ${widthClass} h-full border-l border-[#DFE1F5] shadow-panel flex flex-col overflow-hidden animate-slide-in text-[#465478]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[#F1F2F9] flex items-start justify-between gap-3 bg-[#F9FAFB]">
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? (
              <h3 className="font-display text-[17px] font-bold text-[#465478] truncate">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-[12px] text-[#7D87A3] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-[#DFE1F5] bg-white text-[#7D87A3] hover:text-[#465478] hover:bg-[#F1F2F9] flex items-center justify-center flex-shrink-0 transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#DFE1F5] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#192038]/35 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[24px] border border-[#DFE1F5] shadow-panel overflow-hidden animate-fade-up">
        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <IconTile icon={AlertTriangle} tone={variant === 'danger' ? 'rose' : 'coral'} size="md" />
            <div>
              <h3 className="font-display text-[16px] font-bold text-[#465478]">{title}</h3>
              <p className="text-[13px] text-[#6E7896] mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F1F2F9] flex justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={variant}
            size="sm"
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useOrdexaStore((s) => s.toasts);
  const dismissToast = useOrdexaStore((s) => s.dismissToast);

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#2EB37E] flex-shrink-0" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-[#FA6E43] flex-shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#7584D6] flex-shrink-0" />
          );
        return (
          <div
            key={t.id}
            className="pointer-events-auto bg-white text-[#465478] border border-[#DFE1F5] rounded-full shadow-rescale-hover px-4 py-3 flex items-center justify-between gap-3 text-[12.5px] font-display font-semibold animate-fade-up"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icon}
              <span className="truncate">{t.message}</span>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-[#9CA5BD] hover:text-[#465478] flex-shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rescale-card p-10 text-center">
      {Icon && (
        <div className="mb-3 flex justify-center">
          <IconTile icon={Icon} tone="peri" size="lg" />
        </div>
      )}
      <h4 className="font-display text-[16px] font-bold text-[#465478]">{title}</h4>
      <p className="text-[13px] text-[#7D87A3] mt-1 max-w-md mx-auto leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Hint({ children, className = '' }) {
  return (
    <div
      className={`rounded-[18px] border border-[#E3E6FA] bg-[#F4F5FC] px-4 py-3 flex items-start gap-2.5 text-[12.5px] text-[#545C9E] ${className}`}
    >
      <Info className="w-4 h-4 text-[#7584D6] flex-shrink-0 mt-0.5" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`animate-pulse rounded-full bg-[#F1F2F9] ${className}`} />;
}
