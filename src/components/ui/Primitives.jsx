import React from 'react';
import { X, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { getAttentionStyles, getStatusStyles } from '../../utils/formatters';
import { useOrdexaStore } from '../../store/useOrdexaStore';

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
    'inline-flex items-center justify-center gap-1.5 font-sans font-semibold rounded-[4px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

  const variants = {
    primary: 'bg-gold text-navy-dark hover:bg-gold-hover border border-gold shadow-xs',
    secondary: 'bg-navy text-white hover:bg-navy-dark border border-navy shadow-xs',
    outline: 'bg-white text-navy border border-slate-300 hover:border-navy hover:bg-slate-50',
    outlineLight: 'bg-transparent text-white border border-gold/60 hover:bg-gold hover:text-navy-dark',
    danger: 'bg-red-600 text-white hover:bg-red-700 border border-red-600',
    success: 'bg-emerald-700 text-white hover:bg-emerald-800 border border-emerald-700',
    ghost: 'bg-transparent text-slate-600 hover:text-navy hover:bg-slate-100 border border-transparent',
  };

  const sizes = {
    xs: 'h-7 text-xs px-2.5',
    sm: 'h-8 text-xs px-3',
    md: 'h-9 text-[13px] px-4',
    lg: 'h-11 text-sm px-6',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function SectionEyebrow({ children, light = false, className = '' }) {
  return (
    <div className={`ordexa-eyebrow ${light ? 'text-gold' : 'text-gold-hover'} ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({ title, value, subtitle, icon: Icon, trend, accent = 'default', onClick }) {
  const accentBorder = {
    default: 'border-t-2 border-t-navy',
    gold: 'border-t-2 border-t-gold',
    danger: 'border-t-2 border-t-red-600',
    success: 'border-t-2 border-t-emerald-600',
    warning: 'border-t-2 border-t-amber-500',
  }[accent];

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-[4px] ${accentBorder} p-4 shadow-card transition-all ${
        onClick ? 'cursor-pointer hover:border-gold hover:shadow-elevated' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slateMuted">
          {title}
        </div>
        {Icon && (
          <div className="w-7 h-7 rounded-[4px] bg-surface-muted flex items-center justify-center text-navy flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-gold-hover" />
          </div>
        )}
      </div>
      <div className="mt-1.5 font-sans text-xl font-bold text-navy tracking-tight tabular-nums">{value}</div>
      {(subtitle || trend) && (
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
          {subtitle && <span className="text-slateMuted truncate">{subtitle}</span>}
          {trend && <span className="font-semibold text-emerald-700 whitespace-nowrap">{trend}</span>}
        </div>
      )}
    </div>
  );
}

export function StoreBadge({ store = '' }) {
  let short = store;
  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  if (store.toLowerCase().includes('vedaglow')) {
    short = 'Shopify • VedaGlow';
    style = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (store.toLowerCase().includes('koracraft')) {
    short = 'Woo • KoraCraft';
    style = 'bg-indigo-50 text-indigo-800 border-indigo-200';
  } else if (store.toLowerCase().includes('zaripulse')) {
    short = 'Social • ZariPulse';
    style = 'bg-amber-50 text-amber-800 border-amber-200';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-[3px] border whitespace-nowrap ${style}`}>
      {short}
    </span>
  );
}

export function AttentionBadge({ level }) {
  const s = getAttentionStyles(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[10px] font-bold tracking-wider uppercase border whitespace-nowrap ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {level}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[11px] font-medium border whitespace-nowrap ${getStatusStyles(
        status
      )}`}
    >
      {status}
    </span>
  );
}

export function ReasonCodePill({ code }) {
  return (
    <span className="inline-block font-mono text-[10px] font-semibold bg-slate-100 text-navy border border-slate-200 rounded-[3px] px-1.5 py-0.5 tracking-tight whitespace-nowrap">
      {code}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="font-sans text-xl font-bold text-navy-dark tracking-tight truncate">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, widthClass = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 p-4 backdrop-blur-[1px]">
      <div className={`bg-white w-full ${widthClass} rounded-[6px] border border-slate-200 shadow-elevated max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="flex items-start justify-between px-5 py-3.5 bg-navy text-white border-b border-gold/30">
          <div>
            <h3 className="font-sans text-sm font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-gold p-1 rounded transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 p-4 backdrop-blur-[1px]">
      <div className="bg-white w-full max-w-md rounded-[6px] border border-slate-200 shadow-elevated overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-bold text-navy-dark">{title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={variant}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
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
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-gold flex-shrink-0" />
          );
        return (
          <div
            key={t.id}
            className="pointer-events-auto bg-navy-dark text-white border border-white/10 border-l-4 border-l-gold rounded-[4px] shadow-elevated px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icon}
              <span className="font-medium truncate">{t.message}</span>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-white flex-shrink-0"
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
    <div className="bg-white border border-slate-200 rounded-[4px] p-10 text-center">
      {Icon && (
        <div className="w-11 h-11 mx-auto rounded-full bg-surface-muted flex items-center justify-center text-navy mb-3">
          <Icon className="w-5 h-5 text-gold-hover" />
        </div>
      )}
      <h4 className="font-sans text-sm font-bold text-navy">{title}</h4>
      <p className="text-xs text-slateMuted mt-1 max-w-md mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
