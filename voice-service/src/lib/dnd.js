/**
 * TRAI Do-Not-Disturb (DND) window check for Indian commercial/transactional voice calls.
 * Permitted calling hours default to 09:05–21:00 IST.
 * Adapted from ai-voice-agent (MIT License).
 */
const IST_OFFSET_MIN = 5 * 60 + 30;
const DEFAULT_START_HOUR = Number(process.env.CALLING_DND_START_HOUR_IST ?? 21);
const DEFAULT_END_HOUR = Number(process.env.CALLING_DND_END_HOUR_IST ?? 9);
const RESUME_MIN = Number(process.env.CALLING_DND_RESUME_MINUTE_IST ?? 5);

function toIstView(utc) {
  return new Date(utc.getTime() + IST_OFFSET_MIN * 60_000);
}

export function isDnd(when = new Date(), { startHour = DEFAULT_START_HOUR, endHour = DEFAULT_END_HOUR } = {}) {
  const ist = toIstView(when);
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  if (h >= startHour) return true;
  if (h < endHour) return true;
  if (h === endHour && m < RESUME_MIN) return true;
  return false;
}
