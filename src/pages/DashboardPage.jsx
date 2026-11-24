import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  PackageCheck,
  Sparkles,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Truck,
  Activity,
  Zap,
} from 'lucide-react';
import {
  KpiCard,
  SectionTitle,
  Button,
  AttentionBadge,
  StatusBadge,
  StoreBadge,
  IconTile,
} from '../components/ui/Primitives';
import { MirroredCapsuleChart, PopOutDonutChart } from '../components/charts/ChartKit';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { formatINR, formatDateTime } from '../utils/formatters';

export function DashboardPage() {
  const navigate = useNavigate();
  const orders = useOrdexaStore((s) => s.orders);
  const ndrCases = useOrdexaStore((s) => s.ndrCases);
  const activity = useOrdexaStore((s) => s.activity);
  const messagingExpenses = useOrdexaStore((s) => s.messagingExpenses);
  const approveIntervention = useOrdexaStore((s) => s.approveIntervention);
  const simulateShopifyWebhook = useOrdexaStore((s) => s.simulateShopifyWebhook);
  const setSelectedOrderId = useOrdexaStore((s) => s.setSelectedOrderId);

  const [period, setPeriod] = useState('Month'); // 'Week' | 'Month' | 'Quarter'

  const summary = useMemo(() => {
    const rescuedDelivered = orders.filter((o) => o.rescued && o.status === 'Delivered');
    const rescuedPipeline = orders.filter((o) => o.rescued && o.status !== 'Delivered');
    const cancelledPreDispatch = orders.filter((o) => o.status === 'Cancelled');

    const verifiedProtected = rescuedDelivered.reduce(
      (sum, o) => sum + (o.estimatedRtoExposure || 150),
      0
    );
    const pipelineProtected = rescuedPipeline.reduce(
      (sum, o) => sum + Math.round((o.estimatedRtoExposure || 150) * 0.72),
      0
    );
    const netSavings = Math.max(
      0,
      Math.round(verifiedProtected + pipelineProtected - messagingExpenses)
    );

    const activeQueue = orders.filter(
      (o) => !['Delivered', 'RTO', 'Cancelled'].includes(o.status)
    ).length;

    const highAttentionOpen = orders.filter(
      (o) =>
        o.attentionLevel === 'HIGH' &&
        !['Delivered', 'RTO', 'Cancelled', 'Dispatched'].includes(o.status)
    ).length;

    const totalCompletedOrRescued = orders.filter(
      (o) => o.status === 'Delivered' || o.rescued
    ).length;
    const rescueRate =
      orders.length > 0 ? ((totalCompletedOrRescued / orders.length) * 100).toFixed(1) : '0.0';

    return {
      netSavings,
      activeQueue,
      highAttentionOpen,
      rescueRate,
      rescuedCount: rescuedDelivered.length + rescuedPipeline.length,
      cancelledCount: cancelledPreDispatch.length,
      openNdr: ndrCases.filter((n) => n.recoveryStatus !== 'Recovered').length,
    };
  }, [orders, ndrCases, messagingExpenses]);

  const capsuleSeries = useMemo(() => {
    const boost = Math.min(10, Math.max(0, orders.length - 12));
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
  }, [period, orders.length]);

  const distributionItems = useMemo(() => {
    const total = Math.max(1, orders.length);
    const addrCount = orders.filter(
      (o) => o.recommendedIntervention === 'Address Clarification'
    ).length;
    const waCount = orders.filter(
      (o) => o.recommendedIntervention === 'WhatsApp Confirmation'
    ).length;
    const upiCount = orders.filter(
      (o) =>
        o.recommendedIntervention === 'Optional Partial Advance' ||
        o.recommendedIntervention === 'Manual Review'
    ).length;
    const autoCount = Math.max(1, total - addrCount - waCount - upiCount);

    return [
      {
        name: 'Landmark Sync',
        value: Math.max(12, Math.round((addrCount / total) * 100)),
        color: '#FF9FD7',
      },
      {
        name: 'Auto Manifest',
        value: Math.max(15, Math.round((autoCount / total) * 100)),
        color: '#72E1FF',
      },
      {
        name: 'Partial UPI / Ops',
        value: Math.max(12, Math.round((upiCount / total) * 100)),
        color: '#4A78D6',
      },
      {
        name: 'WhatsApp Intent',
        value: Math.max(14, Math.round((waCount / total) * 100)),
        color: '#8C8CF5',
      },
    ];
  }, [orders]);

  const recentOrders = orders.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* SECTION 1: Exact Rescale "Performance Overview" + 3 Circular-Ring KPI Cards */}
      <section>
        <SectionTitle
          title="Performance Overview"
          subtitle="Real-time pre-dispatch order verification, rescued margin, and COD risk posture"
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/app/rescue')}>
                Rescue Queue ({summary.highAttentionOpen})
              </Button>
              <Button variant="primary" size="sm" onClick={simulateShopifyWebhook}>
                <Zap className="w-3.5 h-3.5" /> Simulate Webhook
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <KpiCard
            title="Net Freight Protected"
            value={formatINR(summary.netSavings)}
            delta={`+${summary.rescuedCount} Rescued`}
            subtitle={`After deducting ₹${messagingExpenses.toFixed(2)} outreach spend`}
            icon={ShieldCheck}
            accent="coral"
            onClick={() => navigate('/app/financial')}
          />
          <KpiCard
            title="Active Orders in Queue"
            value={String(summary.activeQueue)}
            delta={`${summary.highAttentionOpen} High Risk`}
            subtitle={`${orders.length} total workspace orders · ${summary.openNdr} open NDRs`}
            icon={PackageCheck}
            accent="peri"
            onClick={() => navigate('/app/orders')}
          />
          <KpiCard
            title="Delivery & Rescue Rate"
            value={`${summary.rescueRate}%`}
            delta={`${summary.cancelledCount} Pre-Cancel`}
            subtitle="Verified deliveries + confirmed buyer rescues"
            icon={Sparkles}
            accent="pink"
            onClick={() => navigate('/app/analytics')}
          />
        </div>
      </section>

      {/* SECTION 2: Exact Rescale 8/4 Split — Performance Analytics + Resource Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left (8 cols): Performance Analytics + MirroredCapsuleChart */}
        <div className="lg:col-span-8 flex flex-col">
          <SectionTitle title="Performance Analytics" />
          <div className="rescale-card p-6 flex-1 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              {/* Dual Dot Legend matching Rescale Screenshot */}
              <div className="flex flex-wrap items-center gap-5 text-[12.5px] font-display font-semibold text-[#5C6888]">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7584D6]" />
                  Verified Deliveries
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FA9A7C]" />
                  RTO Risk Exposure
                </span>
              </div>

              {/* Pill Period Selector ("Month v") matching Rescale Screenshot */}
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
              topLabel="Verified Deliveries"
              bottomLabel="RTO Risk Exposure"
              maxVal={60}
              unitSuffix="K"
            />
          </div>
        </div>

        {/* Right (4 cols): Resource Distribution + PopOutDonutChart */}
        <div className="lg:col-span-4 flex flex-col">
          <SectionTitle title="Intervention Mix" />
          <div className="rescale-card p-6 flex-1 flex flex-col justify-between">
            <PopOutDonutChart
              items={distributionItems}
              calloutTitle="AI Rescue"
              calloutSubtitle={`${summary.rescuedCount} Saved`}
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: Recent Incoming Orders Table + Live Workspace Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Orders Card */}
        <div className="lg:col-span-8">
          <SectionTitle
            title="Recent Incoming Orders"
            subtitle="Prioritized by pre-dispatch RTO attention level"
            action={
              <Link
                to="/app/orders"
                className="inline-flex items-center gap-1 text-[12.5px] font-display font-bold text-[#545C9E] hover:text-[#465478]"
              >
                View Full Queue <ArrowRight className="w-3.5 h-3.5 text-[#7584D6]" />
              </Link>
            }
          />

          <div className="rescale-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EEF0FA] bg-[#F9FAFB]/80 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-[#8891AA]">
                    <th className="py-3.5 px-5">Order</th>
                    <th className="py-3.5 px-4">Buyer &amp; City</th>
                    <th className="py-3.5 px-4">Value</th>
                    <th className="py-3.5 px-4">Attention</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F2F9] text-[13px]">
                  {recentOrders.map((order) => {
                    const canApprove = ['Pending Verification', 'Held for Review'].includes(
                      order.status
                    );
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-[#F9FAFB] transition-colors group"
                      >
                        <td className="py-3.5 px-5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              navigate('/app/orders');
                            }}
                            className="font-display font-bold text-[#465478] hover:text-[#7584D6] block"
                          >
                            {order.id}
                          </button>
                          <div className="mt-1">
                            <StoreBadge store={order.store} />
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-display font-semibold text-[#465478]">
                            {order.customerName}
                          </div>
                          <div className="text-[11.5px] text-[#8891AA]">
                            {order.address.city} · {order.courier}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-display font-bold text-[#465478] num">
                            {formatINR(order.orderValue)}
                          </div>
                          <div className="text-[11px] text-[#8891AA]">{order.paymentMode}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <AttentionBadge level={order.attentionLevel} />
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {canApprove ? (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => approveIntervention(order.id)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#7584D6]" />
                              Run Rescue
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setSelectedOrderId(order.id);
                                navigate('/app/orders');
                              }}
                            >
                              Inspect
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live Workspace Activity Feed */}
        <div className="lg:col-span-4 space-y-4">
          <SectionTitle
            title="Live Workspace Feed"
            subtitle="Audit log of automated & ops events"
          />

          <div className="rescale-card p-5 space-y-4">
            <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1">
              {activity.slice(0, 7).map((act) => (
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
              <Link to="/app/ndr">
                <Button variant="secondary" size="sm" className="w-full">
                  NDR Queue ({summary.openNdr})
                </Button>
              </Link>
              <Link to="/app/graph">
                <Button variant="outline" size="sm" className="w-full">
                  Buyer Graph
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
