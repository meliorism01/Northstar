import { apiRequest } from './apiClient';

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      qs.set(key, String(val).trim());
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function fetchInterventionsOverview() {
  const res = await apiRequest('/interventions/overview', { method: 'GET' });
  return res.data;
}

export async function fetchInterventionQueue(params = {}) {
  const res = await apiRequest(`/interventions/queue${buildQuery(params)}`, {
    method: 'GET',
  });
  return res.data;
}

export async function evaluateOrderIntervention(orderId, forceRefresh = false) {
  const res = await apiRequest(
    `/interventions/orders/${orderId}/evaluate?forceRefresh=${Boolean(forceRefresh)}`,
    { method: 'POST' }
  );
  return res.data;
}

export async function fetchOrderRecommendations(orderId) {
  const res = await apiRequest(`/interventions/orders/${orderId}/recommendations`, {
    method: 'GET',
  });
  return res.data;
}

export async function fetchRecommendationDetail(recommendationId) {
  const res = await apiRequest(`/interventions/recommendations/${recommendationId}`, {
    method: 'GET',
  });
  return res.data;
}

export async function approveInterventionAction(itemId, body = {}) {
  const res = await apiRequest(`/interventions/items/${itemId}/approve`, {
    method: 'POST',
    body,
  });
  return res.data;
}

export async function rejectInterventionAction(itemId, body = {}) {
  const res = await apiRequest(`/interventions/items/${itemId}/reject`, {
    method: 'POST',
    body,
  });
  return res.data;
}

export async function executeInterventionAction(itemId, body = {}) {
  const res = await apiRequest(`/interventions/items/${itemId}/execute`, {
    method: 'POST',
    body,
  });
  return res.data;
}

export async function recordInterventionOutcome(itemId, body) {
  const res = await apiRequest(`/interventions/items/${itemId}/outcomes`, {
    method: 'POST',
    body,
  });
  return res.data;
}

export async function refreshRecommendation(recommendationId) {
  const res = await apiRequest(`/interventions/recommendations/${recommendationId}/refresh`, {
    method: 'POST',
  });
  return res.data;
}

export async function fetchInterventionPolicy() {
  const res = await apiRequest('/interventions/policy', { method: 'GET' });
  return res.data;
}

export async function updateInterventionPolicy(body) {
  const res = await apiRequest('/interventions/policy', {
    method: 'PUT',
    body,
  });
  return res.data;
}

export async function fetchCustomerConsent(customerId) {
  const res = await apiRequest(`/interventions/customers/${customerId}/consent`, {
    method: 'GET',
  });
  return res.data;
}

export async function updateCustomerConsent(customerId, body) {
  const res = await apiRequest(`/interventions/customers/${customerId}/consent`, {
    method: 'PUT',
    body,
  });
  return res.data;
}
