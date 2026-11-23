import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PackageSearch,
  Share2,
  ShieldAlert,
  Truck,
  BarChart3,
  Settings,
  Bell,
  Search,
  RotateCcw,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  CheckCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { BrandLogo } from '../components/ui/BrandLogo';
import { ConfirmDialog, ToastContainer } from '../components/ui/Primitives';
import { useOrdexaStore } from '../store/useOrdexaStore';

const NAV_GROUPS = [
  {
    group: 'Operations',
    items: [
      { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/app/orders', label: 'Orders Queue', icon: PackageSearch },
      { to: '/app/rescue', label: 'AI RTO Rescue', icon: ShieldAlert },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { to: '/app/graph', label: 'Customer Graph', icon: Share2 },
      { to: '/app/analytics', label: 'Financial Analytics', icon: BarChart3 },
    ],
  },
  {
    group: 'Logistics & System',
    items: [
      { to: '/app/ndr', label: 'Logistics & NDR', icon: Truck },
      { to: '/app/settings', label: 'Store Settings', icon: Settings },
    ],
  },
];

const ROUTE_TITLES = {
  '/app/dashboard': 'Executive Dashboard',
  '/app/orders': 'Unified Order Intelligence Queue',
  '/app/graph': 'Customer Intelligence Graph',
  '/app/rescue': 'AI RTO Rescue Centre',
  '/app/ndr': 'Logistics & NDR Recovery',
  '/app/analytics': 'Financial Leakage Analytics',
  '/app/settings': 'Store Connections & Automation',
};

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const globalSearch = useOrdexaStore((s) => s.globalSearch);
  const setGlobalSearch = useOrdexaStore((s) => s.setGlobalSearch);
  const notifications = useOrdexaStore((s) => s.notifications);
  const markAllNotificationsRead = useOrdexaStore((s) => s.markAllNotificationsRead);
  const resetDemoData = useOrdexaStore((s) => s.resetDemoData);
  const orders = useOrdexaStore((s) => s.orders);
  const ndrCases = useOrdexaStore((s) => s.ndrCases);

  const pendingAttentionCount = orders.filter(
    (o) => o.status === 'Pending Verification' || o.status === 'Held for Review'
  ).length;
  const openNdrCount = ndrCases.filter((n) => n.recoveryStatus !== 'Recovered').length;
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const currentPageTitle = ROUTE_TITLES[location.pathname] || 'Merchant Console';

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (globalSearch.trim() && location.pathname !== '/app/orders') {
      navigate('/app/orders');
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-canvas text-slate-700 font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-navy-deep/60 z-40 lg:hidden backdrop-blur-[1px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Collapsible Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 left-0 z-50 h-screen bg-navy-dark text-white flex flex-col border-r border-white/10 transition-all duration-200 flex-shrink-0 ${
          sidebarOpen ? 'translate-x-0 w-60' : `-translate-x-full lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-60'}`
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-white/10 bg-navy-deep/60">
          <Link to="/" className="flex items-center gap-2 min-w-0" title="ORDEXA Public Site">
            <div className="w-8 h-8 rounded-[4px] bg-gold text-navy-dark flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path d="M14 2L25 8.2V19.8L14 26L3 19.8V8.2L14 2Z" stroke="currentColor" strokeWidth="2.4" />
                <circle cx="14" cy="14" r="3" fill="currentColor" />
              </svg>
            </div>
            {!collapsed && (
              <div className="leading-none truncate">
                <div className="font-serif font-bold tracking-wider text-base text-white">ORDEXA</div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-gold mt-0.5">Merchant OMS</div>
              </div>
            )}
          </Link>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex p-1.5 text-slate-400 hover:text-gold rounded-[4px] hover:bg-white/5 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-300 hover:text-gold"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Pill */}
        {!collapsed && (
          <div className="px-3.5 py-2.5 bg-navy/50 border-b border-white/10">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gold font-semibold">
              Workspace Scope
            </div>
            <div className="text-xs font-semibold text-white mt-0.5 truncate">
              VedaGlow &amp; KoraCraft Group
            </div>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.group}>
              {!collapsed && (
                <div className="px-2.5 mb-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-400">
                  {grp.group}
                </div>
              )}
              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const badge =
                    item.to === '/app/rescue' && pendingAttentionCount > 0
                      ? pendingAttentionCount
                      : item.to === '/app/ndr' && openNdrCount > 0
                      ? openNdrCount
                      : null;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center ${
                          collapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                        } h-9 rounded-[4px] text-[13px] font-medium transition-colors ${
                          isActive
                            ? 'bg-navy text-gold font-semibold shadow-xs border border-gold/25'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                        }`
                      }
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </span>
                      {!collapsed && badge !== null && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[3px] bg-gold text-navy-dark tabular-nums">
                          {badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="p-2.5 border-t border-white/10 space-y-1.5 bg-navy-deep/50">
          <button
            onClick={() => setResetConfirmOpen(true)}
            title={collapsed ? 'Reset Demo State' : undefined}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center' : 'justify-center gap-2'
            } h-8 px-2.5 rounded-[4px] text-xs font-medium text-gold border border-gold/30 hover:bg-gold hover:text-navy-dark transition-colors`}
          >
            <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && <span>Reset Demo State</span>}
          </button>
          <Link
            to="/"
            title={collapsed ? 'Public Landing Page' : undefined}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center' : 'justify-center gap-2'
            } h-8 px-2.5 rounded-[4px] text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors`}
          >
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && <span>Public Website</span>}
          </Link>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact 56px Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-navy hover:bg-slate-100 rounded-[4px]"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 truncate" aria-label="Breadcrumb">
              <Link to="/app/dashboard" className="hover:text-navy font-medium">
                ORDEXA
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="font-semibold text-navy-dark truncate">{currentPageTitle}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search orders, buyers, cities..."
                className="w-60 lg:w-72 h-8 pl-8 pr-12 text-xs bg-surface-canvas border border-slate-200 rounded-[4px] text-navy placeholder:text-slate-400 focus:outline-none focus:border-navy focus:bg-white transition-colors"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1 rounded-[2px]">
                ⌘K
              </kbd>
            </form>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative h-8 w-8 flex items-center justify-center rounded-[4px] text-navy hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-600 rounded-full" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-[6px] shadow-elevated z-50 overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-navy text-white flex items-center justify-between">
                    <span className="text-xs font-semibold">Operational Alerts</span>
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-[11px] text-gold hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark read
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setNotifOpen(false);
                          navigate(n.route);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors ${
                          n.read ? 'opacity-70' : 'bg-gold-subtle/40'
                        }`}
                      >
                        <div className="text-xs font-semibold text-navy">{n.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{n.time}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Merchant Profile */}
            <div className="flex items-center gap-2 pl-2.5 border-l border-slate-200">
              <div className="w-7 h-7 rounded-[4px] bg-navy text-gold font-sans font-bold text-[11px] flex items-center justify-center">
                AM
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold text-navy-dark">Ananya Mehta</div>
                <div className="text-[10px] text-slate-500">Head of Ops</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={() => resetDemoData()}
        title="Reset Demo Workspace?"
        description="This restores all orders, customer graph links, NDR cases, and financial analytics back to the initial baseline."
        confirmLabel="Reset Workspace"
        variant="danger"
      />
      <ToastContainer />
    </div>
  );
}
