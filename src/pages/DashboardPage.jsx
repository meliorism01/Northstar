import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Zap,
  ArrowRight,
  Activity,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { useOrdexaStore } from '../store/useOrdexaStore';
import { Button, PageHeader } from '../components/ui/Primitives';
import { formatINR, formatDateTime } from '../utils/formatters';

const NAVY = '#262B3E';
const GOLD = '#C9B38C';
const EMERALD = '#198754';
const AMBER = '#D97706';
const RED = '#DC3545';
const SLATE = '#687693';

export function DashboardPage() {
  const navigate = useNavigate();
  const orders = useOrdexaStore((s) => s.orders);
  const ndrCases = useOrdexaStore((s) => s.ndrCases);
  const activity = useOrdexaStore((s) => s.activity);
  const simulateShopifyWebhook = useOrdexaStore((s) => s.simulateShopifyWebhook);
  const setSelectedOrderId = useOrdexaStore((s) => s.setSelectedOrderId);

  const [chartTab, setChartTab] = useState('trend');

  const metrics = useMemo(() => {
    const total = orders.length;
    const actionRequired = orders.filter(
      (o) => o.status === 'Pending Verification' || o.status === 'Held for Review' || o.status === 'Awaiting Customer'
    ).length;
    const highAttention = orders.filter(
      (o) => o.attentionLevel === 'HIGH' && !['Delivered', 'RTO', 'Cancelled'].includes(o.status)
    ).length;
    const rescued = orders.filter((o) => o.rescued && o.status !== 'Cancelled' && o.status !== 'RTO').length;
    const delivered = orders.filter((o) => o.status === 'Delivered').length;
    const rto = orders.filter((o) => o.status === 'RTO').length;
    const atRiskNdr = ndrCases.filter((n) => n.recoveryStatus === 'At Risk of RTO').length;
    const lossAvoided = orders
      .filter((o) => o.rescued && o.status !== 'Cancelled' && o.status !== 'RTO')
      .reduce((acc, o) => acc + (o.estimatedRtoExposure || 175), 0);

    return { total, actionRequired, highAttention, rescued, delivered, rto, atRiskNdr, lossAvoided };
  }, [orders, ndrCases]);

  const lifecycleFunnel = useMemo(() => {
    const ingested = orders.length;
    const verified = orders.filter((o) => o.customerConfirmed || o.paymentMode === 'Prepaid').length;
    const dispatched = orders.filter((o) =>
      ['Ready for Dispatch', 'Dispatched', 'NDR Open', 'Delivered', 'RTO'].includes(o.status)
    ).length;
    const delivered = orders.filter((o) => o.status === 'Delivered').length;
    return [
      { stage: 'Ingested', count: ingested },
      { stage: 'Verified', count: verified },
      { stage: 'Dispatched', count: dispatched },
      { stage: 'Delivered', count: delivered },
    ];
  }, [orders]);

  const paymentDist = useMemo(() => {
    const cod = orders.filter((o) => o.paymentMode === 'COD').length;
    const prepaid = orders.filter((o) => o.paymentMode === 'Prepaid').length;
    const partial = orders.filter((o) => o.paymentMode === 'Partial Prepaid').length;
    return [
      { name: 'COD', value: cod, color: NAVY },
      { name: 'Prepaid', value: prepaid, color: GOLD },
      ...(partial > 0 ? [{ name: 'Partial UPI', value: partial, color: EMERALD }] : []),
    ];
  }, [orders]);

  const attentionDist = useMemo(
    () => [
      { level: 'LOW', count: orders.filter((o) => o.attentionLevel === 'LOW').length, color: 'bg-emerald-600' },
      { level: 'MEDIUM', count: orders.filter((o) => o.attentionLevel === 'MEDIUM').length, color: 'bg-amber-500' },
      { level: 'HIGH', count: orders.filter((o) => o.attentionLevel === 'HIGH').length, color: 'bg-red-600' },
    ],
    [orders]
  );

  const deliveryTrend = [
    { day: '18 Nov', successRate: 78, rtoRate: 22 },
    { day: '19 Nov', successRate: 81, rtoRate: 19 },
    { day: '20 Nov', successRate: 84, rtoRate: 16 },
    { day: '21 Nov', successRate: 83, rtoRate: 17 },
    { day: '22 Nov', successRate: 87, rtoRate: 13 },
    { day: '23 Nov', successRate: Math.min(96, 86 + metrics.rescued), rtoRate: Math.max(4, 14 - metrics.rescued) },
  ];

  const leakageOverview = useMemo(() => {
    const realizedRtoLoss = orders
      .filter((o) => o.status === 'RTO')
      .reduce((s, o) => s + (o.forwardShippingCost + o.reverseShippingCost + 35), 0);
    const activeExposure = orders
      .filter((o) => ['Pending Verification', 'Held for Review', 'NDR Open'].includes(o.status))
      .reduce((s, o) => s + (o.estimatedRtoExposure || 170), 0);
    return [
      { stage: 'Est. Freight Avoided', amount: metrics.lossAvoided },
      { stage: 'Active Exposure', amount: activeExposure },
      { stage: 'Realized RTO Loss', amount: realizedRtoLoss },
    ];
  }, [orders, metrics.lossAvoided]);

  const interventionRows = [
    { action: 'Address Clarification', channel: 'WhatsApp', cost: '₹0.90', rate: '84%', impacted: orders.filter((o) => o.recommendedIntervention === 'Address Clarification').length },
    { action: 'WhatsApp Confirmation', channel: 'WhatsApp', cost: '₹0.85', rate: '88%', impacted: orders.filter((o) => o.recommendedIntervention === 'WhatsApp Confirmation').length },
    { action: 'Optional Partial Advance', channel: 'WhatsApp + UPI', cost: '₹1.25', rate: '67%', impacted: orders.filter((o) => o.recommendedIntervention === 'Optional Partial Advance').length },
    { action: 'Manual Review', channel: 'Ops Specialist', cost: '₹18.00', rate: '58%', impacted: orders.filter((o) => o.recommendedIntervention === 'Manual Review').length },
  ];

  const handleSimulateOrder = () => {
    const created = simulateShopifyWebhook();
    if (created) {
      setSelectedOrderId(created.id);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Executive Dashboard"
        subtitle="Operational health, COD rescue velocity, and logistics exposure across your connected merchant stores."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleSimulateOrder}>
              <Zap className="w-3.5 h-3.5 text-gold-hover" /> Simulate Shopify Order
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/app/rescue')}>
              Open Rescue Centre <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </>
        }
      />

      {/* 1. Compact Operational Health Bar (Shopify Analytics style) */}
      <div className="bg-white border border-slate-200 rounded-[4px] shadow-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <button
          onClick={() => navigate('/app/orders')}
          className="text-left px-5 py-4 hover:bg-slate-50/80 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Orders
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-navy-dark tabular-nums">{metrics.total}</span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {metrics.delivered} Del • {metrics.rto} RTO
            </span>
          </div>
        </button>

        <button
          onClick={() => navigate('/app/rescue')}
          className="text-left px-5 py-4 hover:bg-slate-50/80 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Action Required
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-amber-700 tabular-nums">{metrics.actionRequired}</span>
            <span className="text-[11px] font-semibold text-red-600 tabular-nums">
              {metrics.highAttention} High Attention
            </span>
          </div>
        </button>

        <button
          onClick={() => navigate('/app/rescue')}
          className="text-left px-5 py-4 hover:bg-slate-50/80 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Orders Rescued
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">{metrics.rescued}</span>
            <span className="text-[11px] text-slate-500">Verified pre/post dispatch</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/app/analytics')}
          className="text-left px-5 py-4 hover:bg-slate-50/80 transition-colors"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Est. Freight Avoided
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-navy-dark tabular-nums">
              {formatINR(metrics.lossAvoided)}
            </span>
            <span className="text-[11px] font-medium text-gold-hover">View Ledger →</span>
          </div>
        </button>
      </div>

      {/* 2. Urgent Triage Strip */}
      {(metrics.highAttention > 0 || metrics.atRiskNdr > 0) && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-[4px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Operational Attention Needed:</strong>{' '}
              {metrics.highAttention > 0 && (
                <span>{metrics.highAttention} high-attention order(s) awaiting review. </span>
              )}
              {metrics.atRiskNdr > 0 && (
                <span>{metrics.atRiskNdr} NDR shipment(s) at immediate risk of RTO.</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {metrics.highAttention > 0 && (
              <Button variant="outline" size="xs" onClick={() => navigate('/app/rescue')}>
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" /> Triage Rescue Queue
              </Button>
            )}
            {metrics.atRiskNdr > 0 && (
              <Button variant="outline" size="xs" onClick={() => navigate('/app/ndr')}>
                <Truck className="w-3.5 h-3.5 text-amber-700" /> Recover NDRs
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 3. Asymmetric 12-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Cols: Tabbed Primary Chart + Intervention Performance Table */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white border border-slate-200 rounded-[4px] shadow-card">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-sans text-sm font-bold text-navy-dark">
                  {chartTab === 'trend'
                    ? 'Delivery Performance & RTO Trend'
                    : chartTab === 'funnel'
                    ? 'Order Lifecycle Conversion Funnel'
                    : 'Logistics Financial Leakage Overview'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Live metrics recalculated from current workspace state
                </p>
              </div>
              <div className="inline-flex bg-slate-100 p-0.5 rounded-[4px] border border-slate-200">
                {[
                  { id: 'trend', label: 'Delivery Trend' },
                  { id: 'funnel', label: 'Order Funnel' },
                  { id: 'leakage', label: 'Freight Exposure' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setChartTab(t.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-[3px] transition-colors ${
                      chartTab === t.id
                        ? 'bg-white text-navy-dark font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-navy-dark'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === 'trend' ? (
                  <AreaChart data={deliveryTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: SLATE }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: SLATE }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="successRate"
                      name="Delivery Success %"
                      stroke={NAVY}
                      fill={GOLD}
                      fillOpacity={0.28}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="rtoRate"
                      name="RTO Rate %"
                      stroke={RED}
                      fill={RED}
                      fillOpacity={0.08}
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                ) : chartTab === 'funnel' ? (
                  <BarChart data={lifecycleFunnel} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: SLATE }} />
                    <YAxis type="category" dataKey="stage" width={85} tick={{ fontSize: 11, fill: NAVY }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Orders" fill={NAVY} barSize={24} radius={[0, 3, 3, 0]} />
                  </BarChart>
                ) : (
                  <BarChart data={leakageOverview}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 11, fill: NAVY }} />
                    <YAxis tick={{ fontSize: 11, fill: SLATE }} />
                    <Tooltip formatter={(val) => formatINR(val)} />
                    <Bar dataKey="amount" name="Amount (₹)" barSize={40} radius={[3, 3, 0, 0]}>
                      {leakageOverview.map((entry, idx) => (
                        <Cell key={entry.stage} fill={idx === 0 ? EMERALD : idx === 1 ? AMBER : RED} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Compact Intervention Performance Table */}
          <div className="bg-white border border-slate-200 rounded-[4px] shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-sans text-sm font-bold text-navy-dark">
                Intervention Playbook Effectiveness
              </h3>
              <button
                onClick={() => navigate('/app/rescue')}
                className="text-xs font-semibold text-navy hover:text-gold-hover"
              >
                Configure in Rescue →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Intervention Type</th>
                    <th className="py-2.5 px-4">Channel</th>
                    <th className="py-2.5 px-4 text-right">Est. Cost</th>
                    <th className="py-2.5 px-4 text-right">Resolution Rate</th>
                    <th className="py-2.5 px-4 text-right">Orders Queued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {interventionRows.map((r) => (
                    <tr key={r.action} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-semibold text-navy-dark">{r.action}</td>
                      <td className="py-2.5 px-4 text-slate-600">{r.channel}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{r.cost}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {r.rate}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-navy">
                        {r.impacted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: COD vs Prepaid + Attention + Activity Timeline */}
        <div className="lg:col-span-4 space-y-5">
          {/* Mix & Risk Breakdown */}
          <div className="bg-white border border-slate-200 rounded-[4px] shadow-card p-4">
            <h3 className="font-sans text-sm font-bold text-navy-dark mb-3">
              Payment Mix &amp; Risk Attention
            </h3>
            <div className="grid grid-cols-2 gap-3 items-center pb-4 border-b border-slate-100">
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentDist}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={26}
                      outerRadius={44}
                      paddingAngle={2}
                    >
                      {paymentDist.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                {paymentDist.map((p) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                    <span className="font-mono font-bold text-navy-dark tabular-nums">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Attention Distribution
              </div>
              {attentionDist.map((a) => {
                const pct = orders.length ? Math.round((a.count / orders.length) * 100) : 0;
                return (
                  <div key={a.level} className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-navy">{a.level}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {a.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${a.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Operational Activity */}
          <div className="bg-white border border-slate-200 rounded-[4px] shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-sans text-sm font-bold text-navy-dark">Recent Order Activity</h3>
              <Activity className="w-4 h-4 text-gold-hover" />
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {activity.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.orderId?.startsWith('ORD-')) {
                      setSelectedOrderId(item.orderId);
                      navigate('/app/rescue');
                    }
                  }}
                  className="border-l-2 border-gold pl-3 py-0.5 text-xs cursor-pointer hover:bg-slate-50 rounded-r transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[11px] text-navy-dark">{item.category}</span>
                    <span className="font-mono text-[10px] font-semibold text-gold-hover">{item.orderId}</span>
                  </div>
                  <div className="font-medium text-slate-800 mt-0.5 leading-snug">{item.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(item.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
