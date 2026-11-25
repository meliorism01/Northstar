import { apiRequest } from './apiClient';

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchIntelligenceOverview() {
  const response = await apiRequest('/intelligence/overview', { method: 'GET' });
  return response?.data;
}

export async function fetchIntelligenceGraph(params = {}) {
  const response = await apiRequest(`/intelligence/graph${buildQuery(params)}`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchIntelligentCustomers(params = {}) {
  const response = await apiRequest(`/intelligence/customers${buildQuery(params)}`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchCustomer360(customerId) {
  const response = await apiRequest(`/intelligence/customers/${customerId}`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchCustomerGraph(customerId) {
  const response = await apiRequest(`/intelligence/customers/${customerId}/graph`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchCustomerSegments(customerId) {
  const response = await apiRequest(`/intelligence/customers/${customerId}/segments`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchCustomerTimeline(customerId) {
  const response = await apiRequest(`/intelligence/customers/${customerId}/timeline`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchCustomerProducts(customerId) {
  const response = await apiRequest(`/intelligence/customers/${customerId}/products`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchSegments() {
  const response = await apiRequest('/intelligence/segments', {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchSegmentDetail(segmentId) {
  const response = await apiRequest(`/intelligence/segments/${encodeURIComponent(segmentId)}`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchSegmentCustomers(segmentId, params = {}) {
  const response = await apiRequest(
    `/intelligence/segments/${encodeURIComponent(segmentId)}/customers${buildQuery(params)}`,
    { method: 'GET' }
  );
  return response?.data;
}

export async function fetchProductIntelligence(params = {}) {
  const response = await apiRequest(`/intelligence/products${buildQuery(params)}`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchProductCoPurchases(params = {}) {
  const response = await apiRequest(`/intelligence/products/co-purchases${buildQuery(params)}`, {
    method: 'GET',
  });
  return response?.data;
}

export async function fetchProductSkuDetail(sku) {
  const response = await apiRequest(`/intelligence/products/${encodeURIComponent(sku)}`, {
    method: 'GET',
  });
  return response?.data;
}
