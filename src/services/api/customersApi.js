import { apiRequest } from './apiClient';

export async function fetchCustomers({ search = '', page = 0, size = 20 } = {}) {
  const params = new URLSearchParams();
  if (search && search.trim()) params.set('search', search.trim());
  params.set('page', String(page));
  params.set('size', String(size));

  const response = await apiRequest(`/customers?${params.toString()}`, {
    method: 'GET',
  });
  return response.data;
}

export async function fetchCustomerById(customerId) {
  const response = await apiRequest(`/customers/${customerId}`, {
    method: 'GET',
  });
  return response.data;
}

export async function fetchCustomerOrders(customerId) {
  const response = await apiRequest(`/customers/${customerId}/orders`, {
    method: 'GET',
  });
  return response.data;
}
