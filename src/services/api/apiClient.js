const DEFAULT_API_BASE_URL = '/api/v1';

export function getApiBaseUrl() {
  const configured =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_API_BASE_URL
      : undefined;
  return (configured && String(configured).trim()) || DEFAULT_API_BASE_URL;
}

// Short-lived JWT access token is stored strictly in memory (never in localStorage)
let inMemoryAccessToken = null;
let inFlightRefreshPromise = null;
let unauthorizedListener = null;

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function clearAccessToken() {
  inMemoryAccessToken = null;
}

export function onUnauthorizedSession(listener) {
  unauthorizedListener = listener;
}

export class ApiError extends Error {
  constructor(message, { status = 500, errorCode = 'INTERNAL_ERROR', fieldErrors = null } = {}) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors;
  }
}

function generateCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function refreshAccessTokenSingleFlight() {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Correlation-Id': generateCorrelationId(),
      },
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok || !payload?.success || !payload?.data?.accessToken) {
      clearAccessToken();
      throw new ApiError(payload?.message || 'Session expired', {
        status: response.status,
        errorCode: payload?.errorCode || 'UNAUTHORIZED',
      });
    }

    setAccessToken(payload.data.accessToken);
    return payload.data;
  })().finally(() => {
    inFlightRefreshPromise = null;
  });

  return inFlightRefreshPromise;
}

export async function apiRequest(
  path,
  {
    method = 'GET',
    body = undefined,
    headers = {},
    skipAuth = false,
    retryOnUnauthorized = true,
  } = {}
) {
  const baseUrl = getApiBaseUrl();
  const rawPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPath =
    baseUrl.endsWith('/v1') && rawPath.startsWith('/v1/')
      ? rawPath.slice(3)
      : rawPath;

  const requestHeaders = {
    Accept: 'application/json',
    'X-Correlation-Id': generateCorrelationId(),
    ...headers,
  };

  if (body !== undefined && body !== null) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (!skipAuth && inMemoryAccessToken) {
    requestHeaders.Authorization = `Bearer ${inMemoryAccessToken}`;
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${normalizedPath}`, {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(
      'Unable to reach NORTHSTAR backend server. Please verify the backend is running.',
      {
        status: 0,
        errorCode: 'NETWORK_ERROR',
      }
    );
  }

  if (
    response.status === 401 &&
    !skipAuth &&
    retryOnUnauthorized &&
    !normalizedPath.startsWith('/auth/login') &&
    !normalizedPath.startsWith('/auth/register') &&
    !normalizedPath.startsWith('/auth/refresh')
  ) {
    try {
      await refreshAccessTokenSingleFlight();
      return apiRequest(path, {
        method,
        body,
        headers,
        skipAuth,
        retryOnUnauthorized: false,
      });
    } catch (refreshError) {
      clearAccessToken();
      if (typeof unauthorizedListener === 'function') {
        unauthorizedListener(refreshError);
      }
      throw refreshError;
    }
  }

  const payload = await parseJsonSafe(response);

  if (!response.ok || (payload && payload.success === false)) {
    throw new ApiError(payload?.message || `HTTP ${response.status} error`, {
      status: response.status,
      errorCode: payload?.errorCode || 'REQUEST_FAILED',
      fieldErrors: payload?.fieldErrors || null,
    });
  }

  return payload;
}
