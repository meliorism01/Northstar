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

export async function fetchCallingOverview() {
  const res = await apiRequest('/calling/overview', { method: 'GET' });
  return res.data;
}

export async function fetchCallingSessions(params = {}) {
  const res = await apiRequest(`/calling/sessions${buildQuery(params)}`, { method: 'GET' });
  return res.data;
}

export async function fetchCallingSessionDetail(sessionId) {
  const res = await apiRequest(`/calling/sessions/${sessionId}`, { method: 'GET' });
  return res.data;
}

export async function retryCallingSession(sessionId, body = {}) {
  const res = await apiRequest(`/calling/sessions/${sessionId}/retry`, {
    method: 'POST',
    body,
  });
  return res.data;
}

export async function stopCallingSession(sessionId, body = {}) {
  const res = await apiRequest(`/calling/sessions/${sessionId}/stop`, {
    method: 'POST',
    body,
  });
  return res.data;
}

export async function escalateCallingSession(sessionId, body = {}) {
  const res = await apiRequest(`/calling/sessions/${sessionId}/escalate`, {
    method: 'POST',
    body,
  });
  return res.data;
}

export async function simulateCallingOutcome(sessionId, body) {
  const res = await apiRequest(`/calling/sessions/${sessionId}/simulate-outcome`, {
    method: 'POST',
    body,
  });
  return res.data;
}

export async function syncEligibleCodOrders(dispatchImmediate = true) {
  const res = await apiRequest(
    `/calling/sync-eligible-orders?dispatchImmediate=${Boolean(dispatchImmediate)}`,
    { method: 'POST' }
  );
  return res.data;
}

export async function fetchOrderRtoAssessment(orderId) {
  const res = await apiRequest(`/calling/orders/${orderId}/rto-assessment`, {
    method: 'GET',
  });
  return res.data;
}

export async function fetchCallingConfiguration() {
  const res = await apiRequest('/calling/configuration', { method: 'GET' });
  return res.data;
}

export async function updateCallingConfiguration(body) {
  const res = await apiRequest('/calling/configuration', {
    method: 'PUT',
    body,
  });
  return res.data;
}
