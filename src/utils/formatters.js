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
        bg: 'bg-[#FFF1EC]',
        text: 'text-[#E05328]',
        border: 'border-[#FDD6C8]',
        dot: 'bg-[#FA6E43]',
        label: 'HIGH ATTENTION',
      };
    case 'MEDIUM':
      return {
        bg: 'bg-[#FFF5FA]',
        text: 'text-[#C2418B]',
        border: 'border-[#FBCFE8]',
        dot: 'bg-[#FF9FD7]',
        label: 'MEDIUM ATTENTION',
      };
    default:
      return {
        bg: 'bg-[#EEF6FF]',
        text: 'text-[#4A78D6]',
        border: 'border-[#D5E5FE]',
        dot: 'bg-[#7584D6]',
        label: 'LOW ATTENTION',
      };
  }
}

export function getStatusStyles(status) {
  const map = {
    'Pending Verification': 'bg-[#FFF5ED] text-[#D96030] border-[#FDE0CA]',
    'Awaiting Customer': 'bg-[#ECFAFF] text-[#1D82A8] border-[#C5EEFD]',
    'Held for Review': 'bg-[#FFF0F8] text-[#B83B82] border-[#FAD1E8]',
    'Ready for Dispatch': 'bg-[#EEF2FF] text-[#545C9E] border-[#DFE1F5]',
    Dispatched: 'bg-[#F1F2F9] text-[#465478] border-[#DFE1F5]',
    'NDR Open': 'bg-[#FFF1EC] text-[#E05328] border-[#FDD6C8]',
    Delivered: 'bg-[#ECFEF6] text-[#17825B] border-[#C3F3DE]',
    RTO: 'bg-[#FFF0F2] text-[#D13B56] border-[#FECDD6]',
    Cancelled: 'bg-[#F4F5F9] text-[#7D859B] border-[#E3E6F0]',
  };
  return map[status] || 'bg-[#F1F2F9] text-[#465478] border-[#DFE1F5]';
}
