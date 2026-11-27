import crypto from 'node:crypto';

const MAX_SKEW_SECONDS = 300;

export function signPayload(secret, timestampEpochSec, rawBody) {
  const payload = `${timestampEpochSec}.${rawBody ?? ''}`;
  const hex = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return `sha256=${hex}`;
}

export function verifySignature(secret, timestampHeader, signatureHeader, rawBody) {
  if (!secret || !timestampHeader || !signatureHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > MAX_SKEW_SECONDS) return false;

  const expected = signPayload(secret, ts, rawBody);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signatureHeader).trim(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
