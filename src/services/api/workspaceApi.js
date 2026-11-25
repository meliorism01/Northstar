import { apiRequest, setAccessToken } from './apiClient';

export async function fetchAccessibleWorkspaces() {
  const response = await apiRequest('/auth/workspaces', {
    method: 'GET',
  });
  return response.data;
}

export async function selectActiveWorkspace(merchantId) {
  const response = await apiRequest('/auth/select-workspace', {
    method: 'POST',
    body: { merchantId },
  });
  if (response?.data?.accessToken) {
    setAccessToken(response.data.accessToken);
  }
  return response.data;
}

export async function fetchCurrentMerchantWorkspace() {
  const response = await apiRequest('/merchants/current', {
    method: 'GET',
  });
  return response.data;
}

export async function fetchMerchantWorkspaceById(merchantId) {
  const response = await apiRequest(`/merchants/${merchantId}`, {
    method: 'GET',
  });
  return response.data;
}

export async function updateMerchantBusinessName(merchantId, businessName) {
  const response = await apiRequest(`/merchants/${merchantId}`, {
    method: 'PATCH',
    body: { businessName },
  });
  return response.data;
}

export async function fetchWorkspaceMembers(merchantId) {
  const response = await apiRequest(`/merchants/${merchantId}/members`, {
    method: 'GET',
  });
  return response.data;
}

export async function addWorkspaceMember(merchantId, { fullName, email, initialPassword, role }) {
  const response = await apiRequest(`/merchants/${merchantId}/members`, {
    method: 'POST',
    body: { fullName, email, initialPassword, role },
  });
  return response.data;
}
