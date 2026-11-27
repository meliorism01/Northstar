/**
 * Indian & international E.164 phone normalization for SIP trunk routing.
 * Adapted from ai-voice-agent (MIT License).
 */
export function normalizePhone(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[\s\-().]/g, '');

  if (s.startsWith('+')) {
    const digits = s.slice(1);
    if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
    if (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits)) return null;
    return '+' + digits;
  }

  if (s.startsWith('0')) s = s.slice(1);
  if (s.startsWith('91') && s.length === 12 && /^[6-9]/.test(s.slice(2))) {
    return '+91' + s.slice(2);
  }
  if (s.length === 10 && /^[6-9]/.test(s)) {
    return '+91' + s;
  }
  if (s.length === 10) return null;
  if (/^[1-9]\d{6,14}$/.test(s) && s.length > 10) {
    return '+' + s;
  }
  return null;
}

export function isIndianMobile(e164) {
  return typeof e164 === 'string' && /^\+91[6-9]\d{9}$/.test(e164);
}
