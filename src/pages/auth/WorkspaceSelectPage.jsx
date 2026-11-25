import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  OrdexaWordmark,
  Button,
  IconTile,
  SectionEyebrow,
} from '../../components/ui/Primitives';
import { useAuthStore } from '../../store/useAuthStore';

export function WorkspaceSelectPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const workspaces = useAuthStore((s) => s.workspaces);
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const authError = useAuthStore((s) => s.authError);
  const refreshWorkspaces = useAuthStore((s) => s.refreshWorkspaces);
  const selectWorkspace = useAuthStore((s) => s.selectWorkspace);
  const logout = useAuthStore((s) => s.logout);

  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoadingList(true);
    refreshWorkspaces()
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingList(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshWorkspaces]);

  const handleSelect = async (merchantId) => {
    setSelectedId(merchantId);
    try {
      await selectWorkspace(merchantId);
      navigate('/app/dashboard', { replace: true });
    } catch {
      setSelectedId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#465478] flex flex-col justify-between relative overflow-hidden">
      <img
        src="/template-assets/hero-wave-1.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-x-0 top-0 w-full h-[540px] object-cover opacity-65"
      />

      {/* Header */}
      <header className="relative z-10 max-w-[1140px] w-full mx-auto px-4 sm:px-8 pt-6 flex items-center justify-between gap-4">
        <Link to="/" className="inline-flex items-center">
          <OrdexaWordmark size="md" />
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden sm:inline-block text-[12.5px] font-display font-semibold text-[#5C6888]">
              Signed in as <strong className="text-[#465478]">{user.fullName}</strong> ({user.email})
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            data-testid="workspace-logout-btn"
            onClick={handleLogout}
          >
            <LogOut className="w-3.5 h-3.5 text-[#E05328]" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Workspace Picker Body */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[620px] rounded-[28px] bg-white/95 backdrop-blur-xl border border-[#DFE1F5] shadow-panel p-7 sm:p-9 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionEyebrow>Multi-Tenant Access Control</SectionEyebrow>
              <h1 className="mt-3 font-display text-[24px] sm:text-[28px] font-extrabold text-[#465478] tracking-[-0.03em]">
                Select a Merchant Workspace
              </h1>
              <p className="mt-1 text-[13px] text-[#6E7896]">
                Choose which PostgreSQL-isolated merchant tenant you want to operate in.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refreshWorkspaces()}
              className="w-9 h-9 rounded-full bg-[#F1F2F9] border border-[#DFE1F5] flex items-center justify-center text-[#7584D6] hover:text-[#545C9E]"
              title="Refresh workspaces"
            >
              <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {authError && (
            <div
              role="alert"
              data-testid="workspace-error-alert"
              className="rounded-[16px] bg-[#FFF0F2] border border-[#FECDD6] px-4 py-3 flex items-start gap-2.5 text-[12.5px] text-[#D13B56] font-display font-semibold"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3" data-testid="workspace-list">
            {workspaces.map((ws) => {
              const isCurrent = activeWorkspace?.merchantId === ws.merchantId;
              const isPendingThis = isSubmitting && selectedId === ws.merchantId;
              return (
                <div
                  key={ws.merchantId}
                  data-testid={`workspace-card-${ws.businessSlug}`}
                  className={`rounded-[22px] p-5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCurrent
                      ? 'bg-[#F4F5FC] border-[#8C95E8] shadow-rescale-card'
                      : 'bg-white border-[#DFE1F5] hover:border-[#9AA6EA]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <IconTile icon={Building2} tone={isCurrent ? 'peri' : 'cyan'} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-[16px] font-extrabold text-[#465478] truncate">
                          {ws.businessName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold uppercase tracking-wider bg-[#EEF2FF] text-[#545C9E] border border-[#DFE1F5]">
                          {ws.role}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-display font-bold text-[#17825B] bg-[#ECFEF6] border border-[#C3F3DE] px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-[#8891AA] font-mono mt-0.5 truncate">
                        Slug: {ws.businessSlug} · ID: {ws.merchantId}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant={isCurrent ? 'outline' : 'primary'}
                    size="sm"
                    loading={isPendingThis}
                    data-testid={`select-workspace-btn-${ws.businessSlug}`}
                    onClick={() => handleSelect(ws.merchantId)}
                  >
                    {isCurrent ? 'Enter Workspace' : 'Select Workspace'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#EEF0FA] flex items-center justify-between text-[12px] text-[#7C86A2]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2EB37E]" />
              PostgreSQL Membership Verified
            </span>
            {activeWorkspace && (
              <Link
                to="/app/dashboard"
                className="font-display font-bold text-[#545C9E] hover:text-[#465478]"
              >
                Continue to {activeWorkspace.businessName} →
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
