import {
  apiRequest,
  setAccessToken,
  clearAccessToken,
  refreshAccessTokenSingleFlight,
} from './apiClient';

export async function registerMerchantAccount({ businessName, ownerName, email, password }) {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    skipAuth: true,
    body: {
      businessName,
      ownerName,
      email,
      password,
    },
  });
  return response.data;
}

export async function loginWithEmailPassword({ email, password }) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: {
      email,
      password,
    },
  });
  if (response?.data?.accessToken) {
    setAccessToken(response.data.accessToken);
  }
  return response.data;
}

export async function refreshAuthSession() {
  return refreshAccessTokenSingleFlight();
}

export async function logoutAuthSession() {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      retryOnUnauthorized: false,
    });
  } finally {
    clearAccessToken();
  }
}

export async function fetchAuthenticatedUser() {
  const response = await apiRequest('/users/me', {
    method: 'GET',
  });
  return response.data;
}
