export function formatINR(amount, showDecimals = false) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(num);
}

export function formatNumber(num) {
  return new Intl.NumberFormat('en-IN').format(Number(num) || 0);
}

export function formatPercent(value, decimals = 1) {
  const num = Number(value) || 0;
  return `${num.toFixed(decimals)}%`;
}

export function maskPhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 6) return '+91 ••••• •••••';
  const last4 = digits.slice(-4);
  const first2 = digits.length >= 10 ? digits.slice(-10, -8) : digits.slice(0, 2);
  return `+91 ${first2}••• •${last4}`;
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getAttentionStyles(level) {
  switch (level) {
    case 'HIGH':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-600',
        label: 'HIGH ATTENTION',
      };
    case 'MEDIUM':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        label: 'MEDIUM ATTENTION',
      };
    default:
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-600',
        label: 'LOW ATTENTION',
      };
  }
}

export function getStatusStyles(status) {
  const map = {
    'Pending Verification': 'bg-amber-50 text-amber-800 border-amber-200',
    'Awaiting Customer': 'bg-blue-50 text-blue-700 border-blue-200',
    'Held for Review': 'bg-red-50 text-red-700 border-red-200',
    'Ready for Dispatch': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Dispatched: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'NDR Open': 'bg-orange-50 text-orange-800 border-orange-200',
    Delivered: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    RTO: 'bg-rose-100 text-rose-800 border-rose-300',
    Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}
