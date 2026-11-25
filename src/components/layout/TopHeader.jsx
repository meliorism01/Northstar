import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Bell,
  Menu,
  PenSquare,
  CheckCheck,
  Building2,
  X,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { Button, Avatar, AttentionBadge } from '../ui/Primitives';
import { useOrdexaStore } from '../../store/useOrdexaStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatINR } from '../../utils/formatters';

export function TopHeader({ onOpenMobileNav }) {
  const navigate = useNavigate();
  const globalSearch = useOrdexaStore((s) => s.globalSearch);
  const setGlobalSearch = useOrdexaStore((s) => s.setGlobalSearch);
  const setSelectedOrderId = useOrdexaStore((s) => s.setSelectedOrderId);
  const setSelectedCustomerId = useOrdexaStore((s) => s.setSelectedCustomerId);
  const orders = useOrdexaStore((s) => s.orders);
  const customers = useOrdexaStore((s) => s.customers);
  const notifications = useOrdexaStore((s) => s.notifications);
  const markAllNotificationsRead = useOrdexaStore((s) => s.markAllNotificationsRead);
  const simulateShopifyWebhook = useOrdexaStore((s) => s.simulateShopifyWebhook);

  const user = useAuthStore((s) => s.user);
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const currentRole = useAuthStore((s) => s.currentRole);
  const logout = useAuthStore((s) => s.logout);

  const [bellOpen, setBellOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const bellRef = useRef(null);
  const searchRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onDocClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = globalSearch.trim().toLowerCase();
  const matchedOrders = q
    ? orders
      .filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.address.city.toLowerCase().includes(q) ||
          o.courier.toLowerCase().includes(q)
      )
      .slice(0, 4)
    : [];

  const matchedCustomers = q
    ? customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      )
      .slice(0, 3)
    : [];

  const handleSimulateOrder = () => {
    const created = simulateShopifyWebhook();
    if (created?.id) {
      setSelectedOrderId(created.id);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.fullName || 'Ananya Mehta';
  const displayWorkspace = activeWorkspace?.businessName || 'Merchant Workspace';
  const displayRole = currentRole || 'OWNER';

  return (
    <header className="h-[78px] px-4 sm:px-8 flex items-center justify-between gap-4 bg-[#F9FAFB]/90 backdrop-blur-md sticky top-0 z-30">
      {/* Left: Mobile Menu + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl" ref={searchRef}>
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden w-10 h-10 rounded-full bg-white border border-[#DFE1F5] shadow-rescale-card flex items-center justify-center text-[#465478]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative flex-1">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-full transition-all focus-within:bg-white focus-within:shadow-rescale-card focus-within:border-[#DFE1F5] border border-transparent">
            <Search className="w-[18px] h-[18px] text-[#7584D6] flex-shrink-0" strokeWidth={2.1} />
            <input
              type="text"
              value={globalSearch}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search Orders, Buyers, PINs…"
              className="w-full bg-transparent text-[14px] font-display font-medium text-[#465478] placeholder:text-[#6A7594] focus:outline-none"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="text-[#8E98B2] hover:text-[#465478]"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchFocused && q.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white rounded-[22px] border border-[#DFE1F5] shadow-panel p-4 z-50 animate-fade-up">
              {matchedOrders.length === 0 && matchedCustomers.length === 0 ? (
                <div className="text-[12.5px] text-[#8891AA] py-3 text-center">
                  No matching orders or buyer profiles for &ldquo;{globalSearch}&rdquo;
                </div>
              ) : (
                <div className="space-y-3">
                  {matchedOrders.length > 0 && (
                    <div>
                      <div className="text-[10.5px] font-display font-bold uppercase tracking-[0.14em] text-[#8891AA] px-2 mb-1.5">
                        Orders (Sandbox)
                      </div>
                      <div className="space-y-1">
                        {matchedOrders.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                              setSelectedOrderId(o.id);
                              setSearchFocused(false);
                              navigate('/app/orders');
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[14px] hover:bg-[#F4F5FC] text-left transition-colors"
                          >
                            <div>
                              <span className="font-display font-bold text-[12.5px] text-[#465478]">
                                {o.id}
                              </span>
                              <span className="text-[12px] text-[#6E7896] ml-2">
                                {o.customerName} · {o.address.city}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-display font-bold text-[#465478] num">
                                {formatINR(o.orderValue)}
                              </span>
                              <AttentionBadge level={o.attentionLevel} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchedCustomers.length > 0 && (
                    <div>
                      <div className="text-[10.5px] font-display font-bold uppercase tracking-[0.14em] text-[#8891AA] px-2 mb-1.5">
                        Customer Intelligence Graph
                      </div>
                      <div className="space-y-1">
                        {matchedCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setSearchFocused(false);
                              navigate('/app/graph');
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[14px] hover:bg-[#F4F5FC] text-left transition-colors"
                          >
                            <div>
                              <span className="font-display font-bold text-[12.5px] text-[#465478]">
                                {c.name}
                              </span>
                              <span className="text-[12px] text-[#6E7896] ml-2">
                                {c.city} ({c.tier})
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-[#7584D6] inline-flex items-center gap-1">
                              Inspect <ArrowRight className="w-3 h-3" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Active PostgreSQL Workspace Pill + Primary CTA + Bell + Authenticated Operator Chip */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <Link
          to="/workspaces"
          data-testid="active-workspace-badge"
          className="hidden xl:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#E3E6FA] shadow-rescale-card text-[12px] font-display font-semibold text-[#545C9E] hover:border-[#C5CAEC] transition-colors"
          title="Authenticated PostgreSQL Workspace (Click to switch)"
        >
          <span className="w-2 h-2 rounded-full bg-[#2EB37E]" />
          <Building2 className="w-3.5 h-3.5 text-[#7584D6]" />
          <span className="font-bold text-[#465478]">{displayWorkspace}</span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#545C9E]">
            {displayRole}
          </span>
        </Link>

        <Button variant="primary" size="md" onClick={handleSimulateOrder}>
          <PenSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Simulate Order</span>
          <span className="sm:hidden">+ Order</span>
        </Button>

        {/* Notification Bell */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setBellOpen((v) => !v)}
            className="relative w-10 h-10 rounded-full bg-white border border-[#E3E6FA] shadow-rescale-card flex items-center justify-center text-[#7584D6] hover:text-[#545C9E] hover:border-[#C5CAEC] transition-all"
            aria-label="Notifications"
          >
            <Bell className="w-[19px] h-[19px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-[#FA6E43] ring-2 ring-white" />
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white rounded-[24px] border border-[#DFE1F5] shadow-panel overflow-hidden z-50 animate-fade-up">
              <div className="px-5 py-4 bg-[#F9FAFB] border-b border-[#F1F2F9] flex items-center justify-between">
                <div>
                  <h4 className="font-display text-[14.5px] font-bold text-[#465478]">
                    Workspace Alerts
                  </h4>
                  <p className="text-[11.5px] text-[#8891AA]">{unreadCount} unread updates</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="inline-flex items-center gap-1 text-[11.5px] font-display font-bold text-[#7584D6] hover:text-[#545C9E]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-[#F1F2F9] max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setBellOpen(false);
                      if (n.route) navigate(n.route);
                    }}
                    className={`w-full px-5 py-3.5 text-left hover:bg-[#F9FAFB] transition-colors flex items-start gap-3 ${!n.read ? 'bg-[#F6F7FD]/70' : ''
                      }`}
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-[#FA6E43]' : 'bg-[#D0D6EC]'
                        }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-display font-semibold text-[#465478] leading-snug">
                        {n.title}
                      </div>
                      <div className="text-[11px] text-[#8891AA] mt-0.5">{n.time}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Authenticated User Chip */}
        <Link
          to="/app/settings"
          data-testid="active-user-badge"
          className="hidden md:inline-flex items-center gap-2.5 pl-1.5 pr-3.5 py-1 rounded-full bg-white border border-[#E3E6FA] shadow-rescale-card hover:border-[#C5CAEC] transition-all"
        >
          <Avatar name={displayName} size="sm" />
          <div className="leading-tight text-left">
            <div className="font-display text-[12px] font-bold text-[#465478] truncate max-w-[120px]">
              {displayName}
            </div>
            <div className="text-[10.5px] text-[#8891AA] truncate max-w-[120px]">
              {displayWorkspace} · {displayRole}
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          data-testid="header-logout-btn"
          title="Sign out of NORTHSTAR"
          className="w-10 h-10 rounded-full bg-white border border-[#E3E6FA] shadow-rescale-card flex items-center justify-center text-[#D13B56] hover:bg-[#FFF0F2] transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
