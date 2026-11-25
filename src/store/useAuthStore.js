import { create } from 'zustand';
import {
  clearAccessToken,
  getAccessToken,
  onUnauthorizedSession,
} from '../services/api/apiClient';
import {
  loginWithEmailPassword,
  logoutAuthSession,
  refreshAuthSession,
  registerMerchantAccount,
} from '../services/api/authApi';
import {
  fetchAccessibleWorkspaces,
  selectActiveWorkspace,
} from '../services/api/workspaceApi';

const ROLE_RANKS = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

export function hasMinimumRole(currentRole, requiredRole) {
  if (!requiredRole) return true;
  if (!currentRole) return false;
  return (ROLE_RANKS[currentRole] || 0) >= (ROLE_RANKS[requiredRole] || 99);
}

export const useAuthStore = create((set, get) => {
  onUnauthorizedSession(() => {
    clearAccessToken();
    set({
      authStatus: 'unauthenticated',
      user: null,
      workspaces: [],
      activeWorkspace: null,
      currentRole: null,
      isSubmitting: false,
    });
  });

  return {
    authStatus: 'idle', // 'idle' | 'restoring' | 'authenticated' | 'unauthenticated'
    user: null,
    workspaces: [],
    activeWorkspace: null,
    currentRole: null,
    isSubmitting: false,
    authError: null,
    fieldErrors: null,

    clearAuthError: () => set({ authError: null, fieldErrors: null }),

    applySessionPayload: (sessionData) => {
      const activeWorkspace = sessionData?.activeWorkspace || null;
      set({
        authStatus: 'authenticated',
        user: sessionData?.user || null,
        workspaces: sessionData?.workspaces || [],
        activeWorkspace,
        currentRole: activeWorkspace?.role || null,
        isSubmitting: false,
        authError: null,
        fieldErrors: null,
      });
    },

    restoreSession: async () => {
      const currentStatus = get().authStatus;
      if (currentStatus === 'restoring') return;
      if (currentStatus === 'authenticated' && getAccessToken()) return;

      set({ authStatus: 'restoring', authError: null });
      try {
        const sessionData = await refreshAuthSession();
        get().applySessionPayload(sessionData);
        return sessionData;
      } catch {
        clearAccessToken();
        set({
          authStatus: 'unauthenticated',
          user: null,
          workspaces: [],
          activeWorkspace: null,
          currentRole: null,
          isSubmitting: false,
        });
        return null;
      }
    },

    registerMerchant: async ({ businessName, ownerName, email, password }) => {
      set({ isSubmitting: true, authError: null, fieldErrors: null });
      try {
        const result = await registerMerchantAccount({
          businessName,
          ownerName,
          email,
          password,
        });
        set({ isSubmitting: false, authError: null, fieldErrors: null });
        return result;
      } catch (err) {
        set({
          isSubmitting: false,
          authError: err.message || 'Registration failed',
          fieldErrors: err.fieldErrors || null,
        });
        throw err;
      }
    },

    login: async ({ email, password }) => {
      set({ isSubmitting: true, authError: null, fieldErrors: null });
      try {
        const sessionData = await loginWithEmailPassword({ email, password });
        get().applySessionPayload(sessionData);
        return sessionData;
      } catch (err) {
        clearAccessToken();
        set({
          authStatus: 'unauthenticated',
          isSubmitting: false,
          authError: err.message || 'Invalid credentials',
          fieldErrors: err.fieldErrors || null,
        });
        throw err;
      }
    },

    refreshWorkspaces: async () => {
      const data = await fetchAccessibleWorkspaces();
      const workspaces = data?.workspaces || [];
      const activeId = data?.activeMerchantId || get().activeWorkspace?.merchantId || null;
      const matchedActive = workspaces.find((w) => w.merchantId === activeId) || null;
      set({
        workspaces,
        activeWorkspace: matchedActive,
        currentRole: matchedActive?.role || null,
      });
      return workspaces;
    },

    selectWorkspace: async (merchantId) => {
      set({ isSubmitting: true, authError: null });
      try {
        const sessionData = await selectActiveWorkspace(merchantId);
        get().applySessionPayload(sessionData);
        return sessionData;
      } catch (err) {
        set({
          isSubmitting: false,
          authError: err.message || 'Unable to select workspace',
        });
        throw err;
      }
    },

    logout: async () => {
      set({ isSubmitting: true });
      try {
        await logoutAuthSession();
      } finally {
        clearAccessToken();
        set({
          authStatus: 'unauthenticated',
          user: null,
          workspaces: [],
          activeWorkspace: null,
          currentRole: null,
          isSubmitting: false,
          authError: null,
          fieldErrors: null,
        });
      }
    },
  };
});
