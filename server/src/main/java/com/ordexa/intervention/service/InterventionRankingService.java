package com.ordexa.intervention.service;

import com.ordexa.intervention.model.InterventionEnums.InterventionItemRole;
import com.ordexa.intervention.model.InterventionPriority;
import com.ordexa.intervention.model.InterventionType;
import com.ordexa.intervention.rules.InterventionRuleEvaluator.CandidateIntervention;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Transparent, deterministic deduplication and ranking of feasible interventions.
 *
 * Ranking order:
 *   1. Explicit conflicting/denial HUMAN_REVIEW (NBIE-REVIEW-001) always ranks #1 so
 *      customers who denied/cancelled an order are not needlessly contacted first.
 *   2. Priority weight (HIGH > MEDIUM > LOW > NONE).
 *   3. Least customer friction / most direct resolution for the issue
 *      (COD_CONFIRMATION < ADDRESS_CLARIFICATION < HUMAN_REVIEW < OPTIONAL_PARTIAL_ADVANCE).
 *   4. Stable enum ordinal tie-breaker.
 *
 * Emits at most 1 PRIMARY and up to 2 SECONDARY actions. Never invents confidence scores.
 */
@Service
public class InterventionRankingService {

    private static final int MAX_RANKED_ITEMS = 3;

    public record RankedIntervention(
            InterventionItemRole role,
            int rankOrder,
            CandidateIntervention candidate
    ) {
    }

    public List<RankedIntervention> rankAndDeduplicate(List<CandidateIntervention> feasibleCandidates) {
        if (feasibleCandidates == null || feasibleCandidates.isEmpty()) {
            return List.of();
        }

        // 1. Deduplicate by InterventionType while merging rules, reasons, and required evidence
        Map<InterventionType, CandidateIntervention> mergedByType = new LinkedHashMap<>();
        for (CandidateIntervention incoming : feasibleCandidates) {
            mergedByType.merge(incoming.type(), incoming, this::mergeSameType);
        }

        // 2. If any actionable intervention exists, drop NO_INTERVENTION
        if (mergedByType.size() > 1 && mergedByType.containsKey(InterventionType.NO_INTERVENTION)) {
            mergedByType.remove(InterventionType.NO_INTERVENTION);
        }

        // 3. Deterministic sort
        Comparator<CandidateIntervention> comparator = Comparator
                .comparing((CandidateIntervention c) -> isConflictOrDenialReview(c) ? 1 : 0, Comparator.reverseOrder())
                .thenComparingInt(c -> -c.priority().weight())
                .thenComparingInt(c -> c.type().frictionRank())
                .thenComparingInt(c -> c.type().ordinal());

        List<CandidateIntervention> sorted = mergedByType.values().stream()
                .sorted(comparator)
                .limit(MAX_RANKED_ITEMS)
                .toList();

        List<RankedIntervention> ranked = new ArrayList<>(sorted.size());
        for (int i = 0; i < sorted.size(); i++) {
            InterventionItemRole role = (i == 0)
                    ? InterventionItemRole.PRIMARY
                    : InterventionItemRole.SECONDARY;
            ranked.add(new RankedIntervention(role, i + 1, sorted.get(i)));
        }
        return ranked;
    }

    private boolean isConflictOrDenialReview(CandidateIntervention c) {
        return c.type() == InterventionType.HUMAN_REVIEW
                && c.triggeredRuleIds() != null
                && c.triggeredRuleIds().contains("NBIE-REVIEW-001");
    }

    private CandidateIntervention mergeSameType(CandidateIntervention a, CandidateIntervention b) {
        InterventionPriority higherPriority = a.priority().weight() >= b.priority().weight()
                ? a.priority()
                : b.priority();

        Set<String> rules = new LinkedHashSet<>(a.triggeredRuleIds());
        rules.addAll(b.triggeredRuleIds());

        Set<String> reasons = new LinkedHashSet<>(a.reasonCodes());
        reasons.addAll(b.reasonCodes());

        Set<String> evidence = new LinkedHashSet<>(a.requiredEvidence());
        evidence.addAll(b.requiredEvidence());

        String explanation = a.explanation().equals(b.explanation())
                ? a.explanation()
                : a.explanation() + " " + b.explanation();

        return new CandidateIntervention(
                a.type(),
                higherPriority,
                a.proposedChannel(),
                List.copyOf(rules),
                List.copyOf(reasons),
                explanation,
                List.copyOf(evidence),
                a.approvalRequired() || b.approvalRequired());
    }
}
