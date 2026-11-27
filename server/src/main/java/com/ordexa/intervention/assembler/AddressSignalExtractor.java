package com.ordexa.intervention.assembler;

import com.ordexa.intervention.model.InterventionEnums.AddressCompletenessState;
import com.ordexa.intervention.model.InterventionEnums.LandmarkPresence;
import com.ordexa.intervention.model.InterventionEnums.PinValidityState;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Deterministic, PII-minimizing structural address signal parser (ADDRESS_COMPLETENESS_V1).
 *
 * Extracts required-field presence, Indian 6-digit PIN validity, and landmark indicators
 * from {@code orders.shipping_address} (and optional {@code customer_notes}) without storing
 * raw street addresses inside NBIE snapshots or logs.
 */
public final class AddressSignalExtractor {

    public static final String FORMULA_VERSION = "ADDRESS_COMPLETENESS_V1";

    private static final Pattern VALID_INDIAN_PIN = Pattern.compile("\\b[1-9]\\d{5}\\b");
    private static final Pattern INVALID_ZERO_PIN = Pattern.compile("\\b0\\d{5}\\b");
    private static final Pattern DOOR_NUMBER_TOKEN = Pattern.compile("\\b(?:no\\.?|h\\.?no\\.?|flat|house|plot|door|shop|unit|villa|apt|#)\\s*[a-z0-9/-]+|\\b\\d{1,5}[a-zA-Z/-]*\\b", Pattern.CASE_INSENSITIVE);

    private static final List<String> LANDMARK_KEYWORDS = List.of(
            "near", "opp ", "opp.", "opposite", "behind", "beside", "next to",
            "adjacent", "landmark", "pillar", "gate", "chowk", "metro", "temple",
            "mandir", "masjid", "mosque", "church", "gurudwara", "hospital", "clinic",
            "school", "college", "mall", "park", "petrol pump", "bank", "plaza", "circle"
    );

    private static final List<String> STREET_OR_UNIT_KEYWORDS = List.of(
            "house", "flat", "plot", "door", "apt", "apartment", "villa", "floor",
            "wing", "building", "bldg", "block", "sector", "phase", "lane", "street",
            "road", "rd", "marg", "nagar", "colony", "enclave", "layout", "society", "avenue", "vihar"
    );

    private AddressSignalExtractor() {
    }

    public record AddressSignals(
            String formulaVersion,
            AddressCompletenessState completenessState,
            PinValidityState pinValidityState,
            LandmarkPresence landmarkPresence,
            boolean hasStreetOrUnit,
            boolean hasLocalityOrCity,
            List<String> missingFields
    ) {
    }

    public static AddressSignals extract(String shippingAddress, String customerNotes) {
        if (shippingAddress == null || shippingAddress.isBlank()) {
            return new AddressSignals(
                    FORMULA_VERSION,
                    AddressCompletenessState.UNKNOWN,
                    PinValidityState.UNKNOWN,
                    LandmarkPresence.UNKNOWN,
                    false,
                    false,
                    List.of("shipping_address", "house_or_street", "locality_or_city", "pin_code", "landmark"));
        }

        String addr = shippingAddress.trim();
        String lowerAddr = " " + addr.toLowerCase(Locale.ROOT) + " ";
        String combinedNotesLower = customerNotes != null && !customerNotes.isBlank()
                ? lowerAddr + " " + customerNotes.trim().toLowerCase(Locale.ROOT) + " "
                : lowerAddr;

        PinValidityState pinState;
        if (VALID_INDIAN_PIN.matcher(addr).find()) {
            pinState = PinValidityState.VALID;
        } else if (INVALID_ZERO_PIN.matcher(addr).find()) {
            pinState = PinValidityState.INVALID;
        } else {
            pinState = PinValidityState.UNKNOWN;
        }

        boolean landmarkFound = LANDMARK_KEYWORDS.stream().anyMatch(combinedNotesLower::contains);
        LandmarkPresence landmarkPresence = landmarkFound ? LandmarkPresence.PRESENT : LandmarkPresence.MISSING;

        boolean streetKeyword = STREET_OR_UNIT_KEYWORDS.stream().anyMatch(lowerAddr::contains);
        boolean doorToken = DOOR_NUMBER_TOKEN.matcher(addr.replaceAll("\\b\\d{6}\\b", "")).find();
        boolean hasStreetOrUnit = (streetKeyword || doorToken) && addr.length() >= 14;

        String withoutPin = addr.replaceAll("\\b\\d{6}\\b", "").trim();
        String[] commaSegments = withoutPin.split(",");
        String[] wordTokens = withoutPin.split("\\s+");
        boolean hasLocalityOrCity = commaSegments.length >= 2 || wordTokens.length >= 4;

        List<String> missing = new ArrayList<>();
        if (!hasStreetOrUnit) {
            missing.add("house_or_street");
        }
        if (!hasLocalityOrCity) {
            missing.add("locality_or_city");
        }
        if (pinState == PinValidityState.INVALID) {
            missing.add("valid_pin_code");
        } else if (pinState == PinValidityState.UNKNOWN) {
            missing.add("pin_code");
        }
        if (landmarkPresence != LandmarkPresence.PRESENT) {
            missing.add("landmark");
        }

        AddressCompletenessState completeness = missing.isEmpty()
                ? AddressCompletenessState.COMPLETE
                : AddressCompletenessState.INCOMPLETE;

        return new AddressSignals(
                FORMULA_VERSION,
                completeness,
                pinState,
                landmarkPresence,
                hasStreetOrUnit,
                hasLocalityOrCity,
                Collections.unmodifiableList(missing));
    }
}
