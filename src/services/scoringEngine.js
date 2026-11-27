/**
 * NORTHSTAR Modular Rules-Based RTO Risk & Intervention Scoring Engine (v1.0)
 *
 * Design Note:
 * Intentionally implemented as a transparent, auditable rules-based engine
 * rather than pretending an untrained ML model is live. The interface is
 * modular so a supervised ML probability estimator can be plugged in later
 * without changing downstream UI or workflow contracts.
 */

export const REASON_CODE_META = {
  ADDRESS_INCOMPLETE: {
    label: 'Incomplete Address / Missing Landmark',
    severity: 'medium',
    description: 'Street, flat number, or local landmark is missing or under-specified for last-mile courier navigation.',
  },
  CONFIRMATION_PENDING: {
    label: 'Unverified COD Intent',
    severity: 'medium',
    description: 'Cash-on-Delivery order has not yet received explicit buyer confirmation.',
  },
  HIGH_VALUE_ORDER: {
    label: 'High-Value COD Exposure',
    severity: 'high',
    description: 'COD order exceeds merchant high-value threshold, magnifying freight and inventory lockup risk.',
  },
  PRIOR_DELIVERY_EXCEPTION: {
    label: 'Prior Delivery Exception',
    severity: 'medium',
    description: 'Customer profile within this merchant workspace has a previous NDR or failed delivery attempt.',
  },
  NEW_CUSTOMER: {
    label: 'First-Time Buyer',
    severity: 'low',
    description: 'No prior completed delivery history in this merchant store yet.',
  },
  REPEATED_COD_REFUSAL: {
    label: 'Repeated COD Refusal History',
    severity: 'high',
    description: 'Two or more prior COD refusals recorded within this merchant workspace.',
  },
  CALL_CONFIRMED_INTENT: {
    label: 'AI Call Confirmed by Buyer',
    severity: 'low',
    description: 'Customer explicitly confirmed COD order details and delivery availability on voice call.',
  },
  CALL_DENIED_ORDER: {
    label: 'Buyer Denied Placing Order',
    severity: 'high',
    description: 'Customer explicitly denied placing this order during AI verification call.',
  },
  CALL_CANCELLATION_INTENT: {
    label: 'Cancellation Requested on Call',
    severity: 'high',
    description: 'Customer requested order cancellation during AI verification call.',
  },
  CALL_UNANSWERED_NEUTRAL: {
    label: 'Call Unanswered (Neutral Signal)',
    severity: 'low',
    description: 'Unanswered verification call is inconclusive and does not indicate fraud.',
  },
  REPEATED_UNANSWERED_CALLS: {
    label: 'All Verification Attempts Unanswered',
    severity: 'medium',
    description: 'Customer did not answer across multiple scheduled voice attempts; review recommended.',
  },
  CALL_INVALID_PHONE_NUMBER: {
    label: 'Invalid / Unreachable Phone Number',
    severity: 'high',
    description: 'Phone number failed carrier validation; courier last-mile contact will likely fail.',
  },
  CALL_REQUIRES_HUMAN_FOLLOWUP: {
    label: 'Requires Human Specialist Follow-Up',
    severity: 'medium',
    description: 'Buyer requested a live support specialist or gave an inconclusive response.',
  },
  HISTORICAL_CALL_RELIABLE: {
    label: 'Consistent Historical Voice Confirmations',
    severity: 'low',
    description: 'Customer has repeatedly confirmed prior COD calls with zero denials.',
  },
  HISTORICAL_CONFIRMATION_FAILURE: {
    label: 'Repeated Historical Call Denials',
    severity: 'high',
    description: 'Customer denied or cancelled multiple previous COD verification calls.',
  },
};

export const INTERVENTION_CATALOG = {
  'Address Clarification': {
    channel: 'WhatsApp',
    cost: 0.9,
    actionLabel: 'Request Missing Landmark via WhatsApp',
    rescueSuccessProb: 0.78,
  },
  'WhatsApp Confirmation': {
    channel: 'WhatsApp',
    cost: 0.85,
    actionLabel: 'Send 1-Tap WhatsApp COD Confirmation',
    rescueSuccessProb: 0.82,
  },
  'Optional Partial Advance': {
    channel: 'WhatsApp',
    cost: 1.25,
    actionLabel: 'Offer ₹100–₹200 Partial UPI Advance + ₹50 Off',
    rescueSuccessProb: 0.64,
  },
  'Manual Review': {
    channel: 'Ops Queue',
    cost: 18.0,
    actionLabel: 'Route to Merchant Ops Specialist for Verification Call',
    rescueSuccessProb: 0.58,
  },
  'Approve for Dispatch': {
    channel: 'Automated',
    cost: 0,
    actionLabel: 'Clear Immediately for Courier Manifest',
    rescueSuccessProb: 0.96,
  },
};

export function evaluateOrderRisk(order, customer, rules = {}) {
  const highValueThreshold = rules.highValueThreshold ?? 2500;
  const requireCodConfirmThreshold = rules.codConfirmationThreshold ?? 1000;
  const enablePartialPrepaid = rules.enablePartialPrepaid ?? true;

  const reasonCodes = [];
  let riskPoints = 0;

  const isCOD = order.paymentMode === 'COD';
  const hasLandmark = Boolean(order.address?.landmark && order.address.landmark.trim().length >= 4);
  const addressLineLen = (order.address?.line1 || '').trim().length;
  const addressIncomplete = !hasLandmark || addressLineLen < 12;

  const priorRtos = customer?.previousRtos ?? 0;
  const deliveredCount = customer?.successfulDeliveries ?? 0;
  const totalOrders = customer?.totalOrders ?? 1;
  const hasPriorException = priorRtos >= 1 || (customer?.priorNdrCount ?? 0) >= 1;

  if (addressIncomplete) {
    reasonCodes.push('ADDRESS_INCOMPLETE');
    riskPoints += 30;
  }

  if (isCOD && !order.customerConfirmed && order.orderValue >= requireCodConfirmThreshold) {
    reasonCodes.push('CONFIRMATION_PENDING');
    riskPoints += 22;
  }

  if (isCOD && order.orderValue >= highValueThreshold) {
    reasonCodes.push('HIGH_VALUE_ORDER');
    riskPoints += 28;
  }

  if (priorRtos >= 2) {
    reasonCodes.push('REPEATED_COD_REFUSAL');
    riskPoints += 45;
  } else if (hasPriorException) {
    reasonCodes.push('PRIOR_DELIVERY_EXCEPTION');
    riskPoints += 24;
  }

  if (totalOrders <= 1 && deliveredCount === 0 && isCOD) {
    reasonCodes.push('NEW_CUSTOMER');
    riskPoints += 12;
  }

  // Returning verified customer discount on risk points
  if (deliveredCount >= 2 && priorRtos === 0) {
    riskPoints = Math.max(0, riskPoints - 25);
  }

  // Prepaid orders carry substantially lower refusal risk
  if (!isCOD) {
    riskPoints = Math.max(0, riskPoints - 30);
  }

  // Pillar 3 & 4: AI Calling Outcome & Historical Confirmation Signals
  // (NOTE: RTO risk NEVER gates initial COD call eligibility; calling signals refine risk after dialing.)
  let callingOutcomePoints = 0;
  let historicalConfirmationPoints = 0;
  const callOutcome = order.callOutcome || null;
  if (callOutcome === 'CONFIRMED') {
    callingOutcomePoints -= 18;
    reasonCodes.push('CALL_CONFIRMED_INTENT');
  } else if (callOutcome === 'REJECTED') {
    callingOutcomePoints += 55;
    reasonCodes.push('CALL_DENIED_ORDER');
  } else if (callOutcome === 'CANCELLATION_REQUESTED') {
    callingOutcomePoints += 40;
    reasonCodes.push('CALL_CANCELLATION_INTENT');
  } else if (callOutcome === 'INVALID_NUMBER') {
    callingOutcomePoints += 35;
    reasonCodes.push('CALL_INVALID_PHONE_NUMBER');
  } else if (callOutcome === 'HUMAN_ESCALATION' || callOutcome === 'UNCERTAIN') {
    callingOutcomePoints += 12;
    reasonCodes.push('CALL_REQUIRES_HUMAN_FOLLOWUP');
  } else if (callOutcome === 'NO_ANSWER' || callOutcome === 'BUSY') {
    if ((order.callAttemptCount ?? 0) >= (order.callMaxAttempts ?? 3)) {
      callingOutcomePoints += 15;
      reasonCodes.push('REPEATED_UNANSWERED_CALLS');
    } else {
      reasonCodes.push('CALL_UNANSWERED_NEUTRAL');
    }
  }

  const priorConfirmedCalls = customer?.priorConfirmedCalls ?? 0;
  const priorNegativeCalls = customer?.priorNegativeCalls ?? 0;
  if (priorConfirmedCalls >= 2 && priorNegativeCalls === 0) {
    historicalConfirmationPoints -= 12;
    reasonCodes.push('HISTORICAL_CALL_RELIABLE');
  } else if (priorNegativeCalls >= 2) {
    historicalConfirmationPoints += 18;
    reasonCodes.push('HISTORICAL_CONFIRMATION_FAILURE');
  }

  riskPoints = Math.max(0, Math.min(100, riskPoints + callingOutcomePoints + historicalConfirmationPoints));

  let attentionLevel = 'LOW';
  if (riskPoints >= 55) {
    attentionLevel = 'HIGH';
  } else if (riskPoints >= 25) {
    attentionLevel = 'MEDIUM';
  }

  // Proportionate Recommendation Engine
  let recommendedIntervention = 'Approve for Dispatch';
  let explanation =
    'Verified delivery profile with complete address and strong fulfilment reliability. Safe to manifest immediately without adding buyer friction.';

  if (reasonCodes.includes('REPEATED_COD_REFUSAL')) {
    recommendedIntervention = enablePartialPrepaid ? 'Optional Partial Advance' : 'Manual Review';
    explanation =
      'Multiple prior COD refusals recorded in your store history. Requesting a small optional UPI advance or manual verification protects forward and reverse freight.';
  } else if (reasonCodes.includes('HIGH_VALUE_ORDER') && isCOD && !order.customerConfirmed) {
    recommendedIntervention = enablePartialPrepaid ? 'Optional Partial Advance' : 'Manual Review';
    explanation = `High-value COD order (₹${order.orderValue.toLocaleString('en-IN')}). Offering an optional partial UPI token with a small incentive filters low-intent orders politely.`;
  } else if (reasonCodes.includes('ADDRESS_INCOMPLETE')) {
    recommendedIntervention = 'Address Clarification';
    explanation =
      'Delivery address lacks a clear landmark or complete street line, which is the #1 cause of courier "Address Not Found" NDRs in Indian Tier-1/2/3 PIN codes.';
  } else if (reasonCodes.includes('PRIOR_DELIVERY_EXCEPTION') && isCOD) {
    recommendedIntervention = 'Manual Review';
    explanation =
      'Customer has a prior delivery exception on record in this store. A quick human check prevents repeating an avoidable failed attempt.';
  } else if (reasonCodes.includes('CONFIRMATION_PENDING') && isCOD) {
    recommendedIntervention = 'WhatsApp Confirmation';
    explanation =
      'Unconfirmed COD order. A lightweight 1-tap WhatsApp confirmation verifies purchase intent at minimal cost before shipping label generation.';
  }

  const forwardCost = order.forwardShippingCost ?? 68;
  const reverseCost = order.reverseShippingCost ?? 74;
  const codFee = isCOD ? 35 : 0;
  const packagingCost = 22;
  const baseLogisticsExposure = forwardCost + reverseCost + codFee + packagingCost;

  // Estimated RTO probability heuristic (transparent rules-based estimate)
  const rtoProbability =
    attentionLevel === 'HIGH' ? 0.48 : attentionLevel === 'MEDIUM' ? 0.26 : 0.06;
  const estimatedRtoExposure = Math.round(baseLogisticsExposure * (attentionLevel === 'HIGH' ? 1.15 : 1));
  const interventionMeta = INTERVENTION_CATALOG[recommendedIntervention];
  const interventionCost = interventionMeta?.cost ?? 0;
  const expectedFinancialImpact = Math.max(
    0,
    Math.round(estimatedRtoExposure * rtoProbability * (interventionMeta?.rescueSuccessProb ?? 0.7) - interventionCost)
  );

  return {
    attentionLevel,
    riskPoints,
    reasonCodes,
    recommendedIntervention,
    explanation,
    estimatedRtoExposure,
    interventionCost,
    expectedFinancialImpact,
    engineVersion: 'NORTHSTAR Rules Engine v1.0 (ML-Ready)',
  };
}
