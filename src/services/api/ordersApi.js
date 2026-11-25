import { apiRequest } from './apiClient';

export async function fetchOrders({
  search = '',
  orderStatus = '',
  paymentStatus = '',
  fromDate = '',
  toDate = '',
  page = 0,
  size = 20,
  sortBy = 'createdAt',
  sortDir = 'desc',
} = {}) {
  const params = new URLSearchParams();
  if (search && search.trim()) params.set('search', search.trim());
  if (orderStatus && orderStatus !== 'ALL') params.set('orderStatus', orderStatus);
  if (paymentStatus && paymentStatus !== 'ALL') params.set('paymentStatus', paymentStatus);
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  params.set('page', String(page));
  params.set('size', String(size));
  params.set('sortBy', sortBy);
  params.set('sortDir', sortDir);

  const response = await apiRequest(`/orders?${params.toString()}`, {
    method: 'GET',
  });
  return response.data;
}

export async function fetchOrderById(orderId) {
  const response = await apiRequest(`/orders/${orderId}`, {
    method: 'GET',
  });
  return response.data;
}

export async function createOrder(payload) {
  const response = await apiRequest('/orders', {
    method: 'POST',
    body: payload,
  });
  return response.data;
}

export async function updateOrderMetadata(orderId, payload) {
  const response = await apiRequest(`/orders/${orderId}`, {
    method: 'PATCH',
    body: payload,
  });
  return response.data;
}

export async function transitionOrderStatus(orderId, { newStatus, reason }) {
  const response = await apiRequest(`/orders/${orderId}/status`, {
    method: 'POST',
    body: { newStatus, reason },
  });
  return response.data;
}

export async function deleteOrderById(orderId) {
  const response = await apiRequest(`/orders/${orderId}`, {
    method: 'DELETE',
  });
  return response.data;
}

export async function importOrdersFromCsv(csvContent) {
  const response = await apiRequest('/orders/import-csv', {
    method: 'POST',
    body: { csvContent },
  });
  return response.data;
}
