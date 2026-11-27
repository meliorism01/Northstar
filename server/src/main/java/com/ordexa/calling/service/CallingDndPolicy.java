package com.ordexa.calling.service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.regex.Pattern;

/**
 * TRAI Do-Not-Disturb (DND) calling window policy (default 09:05–21:00 IST)
 * and E.164 phone validation / masking utilities adapted from the voice-agent
 * compliance rules.
 */
public final class CallingDndPolicy {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final Pattern INDIAN_MOBILE_E164 = Pattern.compile("^\\+91[6-9]\\d{9}$");
    private static final Pattern INTERNATIONAL_E164 = Pattern.compile("^\\+[1-9]\\d{7,14}$");

    private CallingDndPolicy() {
    }

    public static String normalizeToE164(String rawPhone) {
        if (rawPhone == null || rawPhone.isBlank()) {
            return null;
        }
        String s = rawPhone.trim().replaceAll("[\\s\\-().]", "");
        if (s.startsWith("+")) {
            if (s.startsWith("+91")) {
                return INDIAN_MOBILE_E164.matcher(s).matches() ? s : null;
            }
            return INTERNATIONAL_E164.matcher(s).matches() ? s : null;
        }
        if (s.startsWith("0") && s.length() == 11) {
            s = s.substring(1);
        }
        if (s.length() == 10 && s.charAt(0) >= '6' && s.charAt(0) <= '9' && s.chars().allMatch(Character::isDigit)) {
            return "+91" + s;
        }
        if (s.length() == 12 && s.startsWith("91") && s.charAt(2) >= '6' && s.charAt(2) <= '9'
                && s.chars().allMatch(Character::isDigit)) {
            return "+" + s;
        }
        if (s.length() > 10 && s.charAt(0) >= '1' && s.charAt(0) <= '9' && s.chars().allMatch(Character::isDigit)) {
            String candidate = "+" + s;
            return INTERNATIONAL_E164.matcher(candidate).matches() ? candidate : null;
        }
        return null;
    }

    public static boolean isRoutablePhone(String rawPhone) {
        return normalizeToE164(rawPhone) != null;
    }

    public static boolean isInDndWindow(
            OffsetDateTime utcWhen,
            int dndStartHourIst,
            int dndEndHourIst,
            int dndResumeMinuteIst) {
        ZonedDateTime ist = utcWhen.atZoneSameInstant(IST);
        int h = ist.getHour();
        int m = ist.getMinute();
        if (h >= dndStartHourIst) {
            return true;
        }
        if (h < dndEndHourIst) {
            return true;
        }
        return h == dndEndHourIst && m < dndResumeMinuteIst;
    }

    public static OffsetDateTime adjustForDnd(
            OffsetDateTime targetWhen,
            int dndStartHourIst,
            int dndEndHourIst,
            int dndResumeMinuteIst) {
        if (!isInDndWindow(targetWhen, dndStartHourIst, dndEndHourIst, dndResumeMinuteIst)) {
            return targetWhen;
        }
        ZonedDateTime ist = targetWhen.atZoneSameInstant(IST);
        ZonedDateTime resumeDate = ist.getHour() >= dndStartHourIst ? ist.plusDays(1) : ist;
        ZonedDateTime nextSafeIst = resumeDate
                .withHour(dndEndHourIst)
                .withMinute(dndResumeMinuteIst)
                .withSecond(0)
                .withNano(0);
        return nextSafeIst.toOffsetDateTime();
    }

    public static String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return "****";
        }
        if (phone.startsWith("+91") && phone.length() == 13) {
            return "+91 " + phone.substring(3, 5) + "••••" + phone.substring(9);
        }
        int keepEnd = Math.min(4, phone.length());
        return phone.substring(0, Math.min(4, phone.length() - keepEnd))
                + "••••"
                + phone.substring(phone.length() - keepEnd);
    }
}
