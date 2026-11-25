import React, { useEffect } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, Loader2, ArrowLeft } from 'lucide-react';
import { useAuthStore, hasMinimumRole } from '../../store/useAuthStore';
import { OrdexaWordmark, Button, IconTile } from '../ui/Primitives';

export function ProtectedRoute({
  children,
  requireWorkspace = true,
  minimumRole = null,
}) {
  const location = useLocation();
  const authStatus = useAuthStore((s) => s.authStatus);
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const currentRole = useAuthStore((s) => s.currentRole);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    if (authStatus === 'idle') {
      restoreSession();
    }
  }, [authStatus, restoreSession]);

  if (authStatus === 'idle' || authStatus === 'restoring') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 text-[#465478]">
        <div className="rescale-card px-8 py-7 flex flex-col items-center gap-3 max-w-sm w-full text-center">
          <OrdexaWordmark size="md" />
          <div className="mt-2 inline-flex items-center gap-2 text-[13.5px] font-display font-semibold text-[#545C9E]">
            <Loader2 className="w-4 h-4 animate-spin text-[#7584D6]" />
            <span>Verifying merchant session…</span>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireWorkspace && !activeWorkspace) {
    return <Navigate to="/workspaces" state={{ from: location.pathname }} replace />;
  }

  if (minimumRole && !hasMinimumRole(currentRole, minimumRole)) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-6 text-[#465478]">
        <div className="rescale-card p-8 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <IconTile icon={ShieldAlert} tone="rose" size="lg" />
          </div>
          <h2 className="font-display text-[20px] font-extrabold text-[#465478]">
            Workspace Permission Required
          </h2>
          <p className="text-[13.5px] text-[#6E7896] leading-relaxed">
            Your current role in <strong>{activeWorkspace?.businessName}</strong> is{' '}
            <span className="font-mono font-bold text-[#545C9E]">{currentRole}</span>. This resource
            requires at least <span className="font-mono font-bold text-[#E05328]">{minimumRole}</span>{' '}
            permissions.
          </p>
          <div className="pt-2 flex justify-center gap-2.5">
            <Link to="/app/dashboard">
              <Button variant="primary" size="sm">
                <ArrowLeft className="w-3.5 h-3.5" /> Return to Dashboard
              </Button>
            </Link>
            <Link to="/workspaces">
              <Button variant="outline" size="sm">
                Switch Workspace
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
