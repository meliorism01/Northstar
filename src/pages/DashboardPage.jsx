import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  PackageCheck,
  Sparkles,
  ChevronDown,
  ArrowRight,
  Truck,
  Activity,
  Plus,
  Users,
} from 'lucide-react';
import {
  KpiCard,
  SectionTitle,
  Button,
  StatusBadge,
  IconTile,
} from '../components/ui/Primitives';
import { MirroredCapsuleChart, PopOutDonutChart } from '../components/charts/ChartKit';
import { fetchOrders } from '../services/api/ordersApi';
import { fetchCustomers } from '../services/api/customersApi';
import { useAuthStore } from '../store/useAuthStore';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR, formatDateTime } from '../utils/formatters';

export function DashboardPage() {
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);

  // Live PostgreSQL Orders & Customers State
  const [pgOrdersPage, setPgOrdersPage] = useState({ items: [], totalElements: 0 });
  const [pgCustomersPage, setPgCustomersPage] = useState({ items: [], totalElements: 0 });
  const [pgLoading, setPgLoading] = useState(true);

  // Sandbox Activity & Analytics State (preserved for visual telemetry)
  const sandboxOrders = useOrdexaStore((s) => s.orders);
  const ndrCases = useOrdexaStore((s) => s.ndrCases);
  const activity = useOrdexaStore((s) => s.activity);

  const [period, setPeriod] = useState('Month');

  const loadLiveDashboard = useCallback(async () => {
    if (!activeWorkspace?.merchantId) return;
    setPgLoading(true);
    try {
      const [ordersData, customersData] = await Promise.all([
        fetchOrders({ page: 0, size: 8, sortBy: 'createdAt', sortDir: 'desc' }),
        fetchCustomers({ page: 0, size: 10 }),
      ]);
      setPgOrdersPage(ordersData || { items: [], totalElements: 0 });
      setPgCustomersPage(customersData || { items: [], totalElements: 0 });
    } catch {
      // Handled gracefully if empty
    } finally {
      setPgLoading(false);
    }
  }, [activeWorkspace?.merchantId]);

  useEffect(() => {
    loadLiveDashboard();
  }, [loadLiveDashboard]);

  const pgMetrics = useMemo(() => {
    const items = pgOrdersPage.items || [];
    const recentGmv = items.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const activeOrders = items.filter((o) =>
      ['CREATED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(o.orderStatus)
    ).length;
    return {
      totalOrders: pgOrdersPage.totalElements || 0,
      totalCustomers: pgCustomersPage.totalElements || 0,
      recentGmv,
      activeOrders,
      openNdr: ndrCases.filter((n) => n.recoveryStatus !== 'Recovered').length,
    };
  }, [pgOrdersPage, pgCustomersPage, ndrCases]);

  const capsuleSeries = useMemo(() => {
    const boost = Math.min(10, pgMetrics.totalOrders);
    if (period === 'Week') {
      return [
        { label: 'Mon', top: 34 + boost, bottom: 22 },
        { label: 'Tue', top: 41 + boost, bottom: 18 },
        { label: 'Wed', top: 38 + boost, bottom: 25 },
        { label: 'Thu', top: 47 + boost, bottom: 16 },
        { label: 'Fri', top: 52 + boost, bottom: 19 },
        { label: 'Sat', top: 49 + boost, bottom: 15 },
        { label: 'Sun', top: 44 + boost, bottom: 14 },
      ];
    }
    if (period === 'Quarter') {
      return [
        { label: 'Q1', top: 36, bottom: 29 },
        { label: 'Q2', top: 43, bottom: 23 },
        { label: 'Q3', top: 49, bottom: 18 },
        { label: 'Q4', top: Math.min(58, 53 + boost), bottom: 14 },
      ];
    }
    return [
      { label: 'Jan', top: 32, bottom: 28 },
      { label: 'Feb', top: 38, bottom: 25 },
      { label: 'Mar', top: 35, bottom: 30 },
      { label: 'Apr', top: 42, bottom: 22 },
      { label: 'May', top: 46, bottom: 20 },
      { label: 'Jun', top: 40, bottom: 24 },
      { label: 'Jul', top: 49, bottom: 18 },
      { label: 'Aug', top: 45, bottom: 21 },
      { label: 'Sep', top: 51, bottom: 17 },
      { label: 'Oct', top: 48, bottom: 19 },
      { label: 'Nov', top: Math.min(58, 53 + boost), bottom: 15 },
      { label: 'Dec', top: Math.min(59, 55 + boost), bottom: 13 },
    ];
  }, [period, pgMetrics.totalOrders]);

  const distributionItems = useMemo(() => {
    const items = pgOrdersPage.items || [];
    if (items.length === 0) {
      return [
        { name: 'Created', value: 30, color: '#FF9FD7' },
        { name: 'Confirmed', value: 28, color: '#72E1FF' },
        { name: 'Processing / Shipped', value: 22, color: '#4A78D6' },
        { name: 'Delivered', value: 20, color: '#8C8CF5' },
      ];
    }
    const created = items.filter((o) => o.orderStatus === 'CREATED').length;
    const confirmed = items.filter((o) => o.orderStatus === 'CONFIRMED').length;
    const inTransit = items.filter((o) =>
      ['PROCESSING', 'SHIPPED'].includes(o.orderStatus)
    ).length;
    const delivered = items.filter((o) => o.orderStatus === 'DELIVERED').length;

    return [
      { name: 'Created', value: Math.max(10, created * 15), color: '#FF9FD7' },
      { name: 'Confirmed', value: Math.max(10, confirmed * 15), color: '#72E1FF' },
      { name: 'In Fulfilment', value: Math.max(10, inTransit * 15), color: '#4A78D6' },
      { name: 'Delivered', value: Math.max(10, delivered * 15), color: '#8C8CF5' },
    ];
  }, [pgOrdersPage.items]);

  return (
    <div className="space-y-8">
      {/* SECTION 1: Performance Overview + 3 Circular-Ring KPI Cards */}
      <section>
        <SectionTitle
          title="Performance Overview"
          subtitle={`Live PostgreSQL order core for ${activeWorkspace?.businessName || 'your workspace'}`}
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/app/graph')}>
                <Users className="w-3.5 h-3.5 text-[#7584D6]" /> Customers ({pgMetrics.totalCustomers})
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/app/orders')}>
                <Plus className="w-3.5 h-3.5" /> Create / Import Orders
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <KpiCard
            title="PostgreSQL Workspace Orders"
            value={String(pgMetrics.totalOrders)}
            delta={`${pgMetrics.activeOrders} Active`}
            subtitle="Persisted in merchant-scoped orders table"
            icon={PackageCheck}
            accent="peri"
            onClick={() => navigate('/app/orders')}
          />
          <KpiCard
            title="Recent Order GMV"
            value={formatINR(pgMetrics.recentGmv, true)}
            delta="BigDecimal"
            subtitle="Server-calculated order totals"
            icon={ShieldCheck}
            accent="coral"
            onClick={() => navigate('/app/orders')}
          />
          <KpiCard
            title="Workspace Customers"
            value={String(pgMetrics.totalCustomers)}
            delta="Tenant-Isolated"
            subtitle={`${sandboxOrders.length} orders in RTO simulation sandbox`}
            icon={Sparkles}
            accent="pink"
            onClick={() => navigate('/app/graph')}
          />
        </div>
      </section>

      {/* SECTION 2: 8/4 Split — Performance Analytics + Order Lifecycle Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <SectionTitle title="Performance Analytics" />
          <div className="rescale-card p-6 flex-1 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex flex-wrap items-center gap-5 text-[12.5px] font-display font-semibold text-[#5C6888]">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7584D6]" />
                  Verified Fulfilments
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FA9A7C]" />
                  Exception Exposure
                </span>
              </div>

              <div className="relative inline-flex items-center">
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  aria-label="Select analytics period"
                  className="appearance-none bg-[#F9FAFB] hover:bg-[#F1F2F9] border border-[#DFE1F5] rounded-full pl-4 pr-9 py-1.5 text-[12.5px] font-display font-bold text-[#465478] focus:outline-none focus:border-[#7584D6] cursor-pointer transition-colors"
                >
                  <option value="Week">Week</option>
                  <option value="Month">Month</option>
                  <option value="Quarter">Quarter</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#7584D6] pointer-events-none absolute right-3" />
              </div>
            </div>

            <MirroredCapsuleChart
              data={capsuleSeries}
              topLabel="Verified Fulfilments"
              bottomLabel="Exception Exposure"
              maxVal={60}
              unitSuffix="K"
            />
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col">
          <SectionTitle title="Order Lifecycle Mix" />
          <div className="rescale-card p-6 flex-1 flex flex-col justify-between">
            <PopOutDonutChart
              items={distributionItems}
              calloutTitle="Order Core"
              calloutSubtitle={`${pgMetrics.totalOrders} Live`}
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: Live PostgreSQL Orders Table + Workspace Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <SectionTitle
            title="Recent Workspace Orders (PostgreSQL)"
            subtitle="Real database-backed orders scoped to your active merchant tenant"
            action={
              <Link
                to="/app/orders"
                className="inline-flex items-center gap-1 text-[12.5px] font-display font-bold text-[#545C9E] hover:text-[#465478]"
              >
                Open Order Management <ArrowRight className="w-3.5 h-3.5 text-[#7584D6]" />
              </Link>
            }
          />

          <div className="rescale-card overflow-hidden">
            {pgLoading && pgOrdersPage.items.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-[#7C86A2]">
                Loading orders from PostgreSQL…
              </div>
            ) : pgOrdersPage.items.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="font-display text-[15px] font-bold text-[#465478]">
                  No PostgreSQL orders created in {activeWorkspace?.businessName} yet
                </div>
                <p className="text-[12.5px] text-[#7C86A2] max-w-md mx-auto">
                  Create a manual order or import a CSV batch in Order Management to persist real orders in PostgreSQL.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/app/orders')}
                >
                  <Plus className="w-3.5 h-3.5" /> Create First Order
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#EEF0FA] bg-[#F9FAFB]/80 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                      <th className="py-3.5 px-5">Order #</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Total</th>
                      <th className="py-3.5 px-4">Payment</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F2F9] text-[13px]">
                    {pgOrdersPage.items.map((order) => (
                      <tr key={order.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3.5 px-5">
                          <span className="font-display font-extrabold text-[#465478] block">
                            {order.orderNumber}
                          </span>
                          <span className="text-[10.5px] text-[#7584D6] font-bold">
                            {order.source}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-display font-semibold text-[#465478]">
                            {order.customerName}
                          </div>
                          <div className="text-[11.5px] text-[#8891AA]">
                            +91 {order.customerPhone}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-display font-bold text-[#465478] num">
                          {formatINR(order.totalAmount, true)}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={order.paymentStatus} />
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={order.orderStatus} />
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => navigate('/app/orders')}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Workspace Activity & Sandbox Links */}
        <div className="lg:col-span-4 space-y-4">
          <SectionTitle
            title="Live Workspace Feed"
            subtitle="Operational & simulation events"
          />

          <div className="rescale-card p-5 space-y-4">
            <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1">
              {activity.slice(0, 6).map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-3 pb-3 border-b border-[#F1F2F9] last:border-b-0 last:pb-0"
                >
                  <IconTile
                    icon={act.category === 'NDR Event' ? Truck : Activity}
                    tone={
                      act.category === 'NDR Event'
                        ? 'coral'
                        : act.category === 'Delivered'
                          ? 'emerald'
                          : 'peri'
                    }
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[12.5px] font-bold text-[#465478] leading-snug">
                      {act.title}
                    </div>
                    <p className="text-[11.5px] text-[#7C86A2] mt-0.5 leading-relaxed">
                      {act.detail}
                    </p>
                    <div className="text-[10.5px] text-[#9AA3BA] mt-1">
                      {formatDateTime(act.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#EEF0FA] grid grid-cols-2 gap-2.5">
              <Link to="/app/orders">
                <Button variant="primary" size="sm" className="w-full">
                  Order Core
                </Button>
              </Link>
              <Link to="/app/graph">
                <Button variant="outline" size="sm" className="w-full">
                  Customers
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
