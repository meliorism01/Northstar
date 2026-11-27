import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  PackageCheck,
  Compass,
  PhoneCall,
  GitFork,
  ShieldCheck,
  Truck,
  BarChart3,
  Wallet,
  PlugZap,
  Settings,
  RotateCcw,
  ArrowUpRight,
  Building2,
  LogOut,
  Repeat,
  X,
} from 'lucide-react';
import { OrdexaWordmark, ConfirmDialog } from '../ui/Primitives';
import { useOrdexaStore } from '../../store/useOrdexaStore';
import { useAuthStore } from '../../store/useAuthStore';

export function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const navigate = useNavigate();
  const orders = useOrdexaStore((s) => s.orders);
  const ndrCases = useOrdexaStore((s) => s.ndrCases);
  const resetDemoData = useOrdexaStore((s) => s.resetDemoData);

  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const workspaces = useAuthStore((s) => s.workspaces);
  const currentRole = useAuthStore((s) => s.currentRole);
  const logout = useAuthStore((s) => s.logout);

  const [confirmReset, setConfirmReset] = useState(false);

  const pendingOrdersCount = orders.filter((o) =>
    ['Pending Verification', 'Awaiting Customer', 'Held for Review'].includes(o.status)
  ).length;

  const rescueQueueCount = orders.filter(
    (o) =>
      o.attentionLevel !== 'LOW' &&
      !['Delivered', 'RTO', 'Cancelled', 'Dispatched'].includes(o.status)
  ).length;

  const openNdrCount = ndrCases.filter((n) => n.recoveryStatus !== 'Recovered').length;

  const navItems = [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { to: '/app/orders', label: 'Order Management', icon: PackageCheck, badge: pendingOrdersCount },
    { to: '/app/interventions', label: 'NBIE Interventions', icon: Compass },
    { to: '/app/calling', label: 'Calling Intelligence', icon: PhoneCall },
    { to: '/app/graph', label: 'Customer Intelligence', icon: GitFork },
    { to: '/app/rescue', label: 'AI RTO Rescue', icon: ShieldCheck, badge: rescueQueueCount, accent: 'coral' },
    { to: '/app/ndr', label: 'NDR Recovery', icon: Truck, badge: openNdrCount },
    { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/app/financial', label: 'Financial Intelligence', icon: Wallet },
    { to: '/app/integrations', label: 'Integrations', icon: PlugZap },
  ];

  const handleLogout = async () => {
    if (onCloseMobile) onCloseMobile();
    await logout();
    navigate('/login', { replace: true });
  };

  const sidebarBody = (
    <div className="flex flex-col h-full w-[256px] bg-[#F9FAFB] select-none">
      {/* Top Brand Header */}
      <div className="px-7 pt-7 pb-4 flex items-center justify-between">
        <Link
          to="/app/dashboard"
          onClick={onCloseMobile}
          className="inline-flex flex-col group focus:outline-none"
        >
          <OrdexaWordmark size="md" />
          <span className="text-[10.5px] font-display font-semibold text-[#8E98B2] mt-1 tracking-wide">
            Merchant Intelligence Suite
          </span>
        </Link>
        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden w-8 h-8 rounded-full bg-white border border-[#DFE1F5] flex items-center justify-center text-[#5C6888]"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active PostgreSQL Merchant Workspace Card */}
      {activeWorkspace && (
        <div className="px-4 pb-3">
          <div
            data-testid="sidebar-workspace-card"
            className="rounded-[18px] bg-white border border-[#DFE1F5] shadow-rescale-card p-3.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-[#7584D6] flex-shrink-0" />
                <span
                  data-testid="sidebar-workspace-name"
                  className="font-display text-[13px] font-extrabold text-[#465478] truncate"
                >
                  {activeWorkspace.businessName}
                </span>
              </div>
              <span
                data-testid="sidebar-workspace-role"
                className="px-2 py-0.5 rounded-full text-[10px] font-display font-bold uppercase bg-[#EEF2FF] text-[#545C9E] border border-[#DFE1F5]"
              >
                {currentRole}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#7D87A3] pt-1 border-t border-[#F1F2F9]">
              <span className="truncate font-mono">{activeWorkspace.businessSlug}</span>
              <Link
                to="/workspaces"
                onClick={onCloseMobile}
                data-testid="sidebar-switch-workspace"
                className="inline-flex items-center gap-1 font-display font-bold text-[#7584D6] hover:text-[#545C9E]"
              >
                <Repeat className="w-3 h-3" />
                <span>Switch ({workspaces.length || 1})</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Primary Navigation */}
      <nav className="flex-1 px-4 py-1 space-y-1 overflow-y-auto nav-scroll" aria-label="Merchant navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `group flex items-center justify-between gap-3 px-4 py-3 rounded-[16px] font-display text-[13.5px] transition-all duration-150 ${isActive
                  ? 'bg-[#EEF0FA] text-[#465478] font-bold shadow-[0_2px_10px_-4px_rgba(84,92,158,0.14)]'
                  : 'text-[#5C6888] font-semibold hover:bg-[#F2F4FB] hover:text-[#465478]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center gap-3.5 min-w-0">
                    <Icon
                      className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-[#6370D2]' : 'text-[#7584D6] group-hover:text-[#545C9E]'
                        }`}
                      strokeWidth={1.9}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`text-[10.5px] font-display font-bold px-2 py-0.5 rounded-full num ${item.accent === 'coral'
                        ? 'bg-[#FFF1EC] text-[#E05328] border border-[#FDD6C8]'
                        : isActive
                          ? 'bg-white text-[#545C9E] border border-[#DFE1F5]'
                          : 'bg-[#F1F2F9] text-[#6A7594]'
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Pinned Settings + Workspace Controls */}
      <div className="px-4 pb-6 pt-3 space-y-1.5">
        <NavLink
          to="/app/settings"
          onClick={onCloseMobile}
          className={({ isActive }) =>
            `group flex items-center gap-3.5 px-4 py-3 rounded-[16px] font-display text-[13.5px] transition-all ${isActive
              ? 'bg-[#EEF0FA] text-[#465478] font-bold'
              : 'text-[#5C6888] font-semibold hover:bg-[#F2F4FB] hover:text-[#465478]'
            }`
          }
        >
          <Settings className="w-[18px] h-[18px] text-[#7584D6]" strokeWidth={1.9} />
          <span>Settings &amp; Team</span>
        </NavLink>

        <button
          type="button"
          onClick={handleLogout}
          data-testid="sidebar-logout-btn"
          className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-[16px] font-display text-[13px] font-semibold text-[#D13B56] hover:bg-[#FFF0F2] transition-colors"
        >
          <LogOut className="w-[17px] h-[17px]" strokeWidth={1.9} />
          <span>Sign Out</span>
        </button>

        <div className="pt-1.5 px-2 flex items-center justify-between gap-2 text-[11.5px] font-display font-semibold text-[#7D87A3]">
          <Link
            to="/"
            onClick={onCloseMobile}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-[#EEF0FA] hover:text-[#465478] transition-colors"
          >
            <span>Public Site</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#7584D6]" />
          </Link>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-[#FFF1EC] hover:text-[#E05328] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Sandbox</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetDemoData}
        title="Reset Sandbox Orders?"
        description="This restores the simulated order queue, customer graph links, and NDR cases back to the initial baseline without affecting your PostgreSQL merchant account."
        confirmLabel="Reset Sandbox"
        variant="danger"
      />
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block flex-shrink-0 sticky top-0 h-screen z-30 border-r border-[#EEF0FA]">
        {sidebarBody}
      </aside>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-[#192038]/30 backdrop-blur-xs"
          onClick={onCloseMobile}
        >
          <div className="h-full shadow-panel animate-slide-in" onClick={(e) => e.stopPropagation()}>
            {sidebarBody}
          </div>
        </div>
      )}
    </>
  );
}
